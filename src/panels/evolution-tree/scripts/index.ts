import { ElementNotFoundError, VariableNotDefinedError } from "../../../errors";
import { useTranslation } from "../../../i18n/use-translation";
import { Achievement, AchievementId, isAchievedCondition, isExperienceCondition, isSeenCondition, OPEN_ENCYCLOPEDIA_ENTRY, type Condition, type Pet, type PetId, type PetLevel } from "../../../types";

declare global {
  interface Window {
    DATA?: Pet[];
    SEEN?: PetId[];
    SPRITES?: Record<PetId, string>;
    ACHIEVED?: AchievementId[];
    ACHIEVEMENTS?: Achievement[];
    acquireVsCodeApi: () => {
      postMessage(data: unknown): void;
      setState(data: unknown): void;
      getState(): unknown;
    }
  }
}

const DISPLAY_HIDDEN = false;

const { t: tCommon } = useTranslation('common');
const { t } = useTranslation('encyclopedia');

const vscode = acquireVsCodeApi();

let zoomLevel = 1;
let searchTerm = '';

type GraphNode = Pet & {
  evolutions: NonNullable<Pet["evolutions"]>;
};

type GraphInstance = {
  instanceId: string;
  sourceId: PetId;
  pet: GraphNode;
};

type GraphEdge = {
  from: string;
  to: string;
  conds: Condition[];
};

function getTreeNodes(rootId: PetId, byId: Map<PetId, GraphNode>): Set<PetId> {
  const visited = new Set<PetId>();
  function visit(id: PetId) {
    if (visited.has(id)) {
      return;
    };
    visited.add(id);
    const node = byId.get(id);
    if (!node) {
      return;
    };
    for (const evo of node.evolutions) {
      visit(evo.target);
    }
  }
  visit(rootId);
  return visited;
}

function hasMatchDescendant(id: PetId, byId: Map<PetId, GraphNode>, matches: Set<PetId>, memo: Map<PetId, boolean> = new Map()): boolean {
  if (memo.has(id)) {
    return memo.get(id) as boolean;
  };
  if (matches.has(id)) {
    memo.set(id, true);
    return true;
  }
  const node = byId.get(id);
  if (!node) {
    memo.set(id, false);
    return false;
  }
  for (const evo of node.evolutions) {
    if (hasMatchDescendant(evo.target, byId, matches, memo)) {
      memo.set(id, true);
      return true;
    }
  }
  memo.set(id, false);
  return false;
}

function markSubtree(id: PetId, byId: Map<PetId, GraphNode>, relevant: Set<PetId>) {
  if (relevant.has(id)) {
    return;
  };
  relevant.add(id);
  const node = byId.get(id);
  if (!node) {
    return;
  };
  for (const evo of node.evolutions) {
    markSubtree(evo.target, byId, relevant);
  }
}

function markRelevant(id: PetId, byId: Map<PetId, GraphNode>, matches: Set<PetId>, relevant: Set<PetId>) {
  if (relevant.has(id)) {
    return;
  };
  if (matches.has(id)) {
    markSubtree(id, byId, relevant);
    return;
  }
  relevant.add(id);
  const node = byId.get(id);
  if (!node) {
    return;
  };
  for (const evo of node.evolutions) {
    if (hasMatchDescendant(evo.target, byId, matches)) {
      markRelevant(evo.target, byId, matches, relevant);
    }
  }
}

function buildGraph(nodes: Pet[]) {
  const byId = new Map<PetId, GraphNode>(
    nodes.map(n => [
      n.id,
      {
        ...n,
        evolutions: n.evolutions ?? []
      }
    ])
  );

  const incoming = new Map<PetId, number>();

  for (const node of byId.values()) {
    for (const evo of node.evolutions) {
      incoming.set(evo.target, (incoming.get(evo.target) ?? 0) + 1);
    }
  }

  const roots = [...byId.values()]
    .filter(n => !incoming.has(n.id))
    .sort(
      (a, b) =>
        (a.level ?? 0) - (b.level ?? 0) ||
        (a.name ?? "").localeCompare(b.name ?? "")
    );

  const instances = new Map<string, GraphInstance>();
  const edges: GraphEdge[] = [];
  const rootInstanceIds: string[] = [];
  // Cuántas instancias distintas tienen ya una arista hacia cada instanceId (para detectar convergencias en cadena)
  const instanceIncoming = new Map<string, number>();

  function getChildren(node: GraphNode) {
    return node.evolutions
      .map(evo => ({
        evo,
        target: byId.get(evo.target)
      }))
      .filter(
        (item): item is { evo: GraphNode["evolutions"][number]; target: GraphNode } => {
          return typeof item.target !== "undefined";
        })
      .sort(
        (a, b) =>
          (a.target.level ?? 0) - (b.target.level ?? 0) ||
          (a.target.name ?? "").localeCompare(b.target.name ?? "")
      );
  }

  function ensureInstance(
    pet: GraphNode,
    instanceId: string
  ): GraphInstance {
    const existing = instances.get(instanceId);
    if (existing) {
      return existing;
    }

    const created: GraphInstance = {
      instanceId,
      sourceId: pet.id,
      pet
    };

    instances.set(instanceId, created);
    return created;
  }

  function expand(instance: GraphInstance, path = new Set<PetId>()) {
    if (path.has(instance.sourceId)) {
      console.warn(`Cycle detected at pet ${instance.sourceId}`);
      return;
    }

    const nextPath = new Set(path);
    nextPath.add(instance.sourceId);

    const children = getChildren(instance.pet);

    children.forEach(({ evo, target }, index) => {
      if (nextPath.has(target.id)) {
        console.warn(`Skipping cyclic evolution ${instance.sourceId} -> ${target.id}`);
        return;
      }

      const targetIncoming = incoming.get(target.id) ?? 0;
      const existingIncoming = instanceIncoming.get(target.id.toString()) ?? 0;

      const mustDuplicate = targetIncoming > 1 || existingIncoming > 0;
      const childInstanceId = mustDuplicate
        ? `${target.id}__from__${instance.instanceId}__${index}`
        : target.id.toString();

      const childInstance = ensureInstance(target, childInstanceId);


      const conds = (evo.conds ?? []).concat(target?.conds ?? []);

      edges.push({
        from: instance.instanceId,
        to: childInstance.instanceId,
        conds
      });

      instanceIncoming.set(
        childInstance.instanceId,
        (instanceIncoming.get(childInstance.instanceId) ?? 0) + 1
      );

      expand(childInstance, nextPath);
    });
  }

  for (const root of roots) {
    const rootInstance = ensureInstance(root, root.id.toString());
    rootInstanceIds.push(rootInstance.instanceId);
    expand(rootInstance);
  }

  const includedPets = new Set([...instances.values()].map(inst => inst.sourceId));

  // Nodos desconectados / huérfanos
  for (const node of byId.values()) {
    if (!includedPets.has(node.id)) {
      ensureInstance(node, node.id.toString());
    }
  }

  return {
    byId,
    incoming,
    roots,
    instances,
    edges,
    rootInstanceIds
  };
}

function layoutForest(nodes: Pet[]) {
  const graph = buildGraph(nodes);

  let rowCursor = 0;
  const pos = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  function getChildren(instanceId: string) {
    return graph.edges
      .filter(edge => edge.from === instanceId)
      .map(edge => {
        const target = graph.instances.get(edge.to);
        return target
          ? {
            edge,
            target
          }
          : undefined;
      })
      .filter(
        (item): item is { edge: GraphEdge; target: GraphInstance } =>
          typeof item !== "undefined"
      )
      .sort(
        (a, b) => {
          return (a.target.pet.level ?? 0) - (b.target.pet.level ?? 0) ||
            (a.target.pet.name ?? "").localeCompare(b.target.pet.name ?? "");
        }
      );
  }

  function place(instanceId: string): { x: number; y: number } {
    const existing = pos.get(instanceId);
    if (existing) {
      return existing;
    }

    const instance = graph.instances.get(instanceId);
    if (!instance || !instance.pet) {
      console.error("Instance missing or has no pet:", instanceId, instance);
      return { x: 0, y: 0 };
    }

    const children = getChildren(instanceId);

    if (children.length === 0) {
      const y = rowCursor++;
      const p = { x: instance.pet.level ?? 0, y };
      pos.set(instanceId, p);
      visited.add(instanceId);
      return p;
    }

    const childPositions = children.map(({ target }) => place(target.instanceId));
    const minY = Math.min(...childPositions.map(p => p.y));
    const maxY = Math.max(...childPositions.map(p => p.y));
    const y = (minY + maxY) / 2;

    const p = { x: instance.pet.level ?? 0, y };
    pos.set(instanceId, p);
    visited.add(instanceId);
    return p;
  }

  // Coloca cada árbol raíz con separación
  for (const rootInstanceId of graph.rootInstanceIds) {
    place(rootInstanceId);
    rowCursor += 2; // Separación entre árboles
  }

  // Coloca nodos desconectados / huérfanos
  for (const instance of graph.instances.values()) {
    if (!visited.has(instance.instanceId)) {
      pos.set(instance.instanceId, {
        x: instance.pet.level ?? 0,
        y: rowCursor++
      });
    }
  }

  const edges = graph.edges
    .map(edge => {
      const from = pos.get(edge.from);
      const to = pos.get(edge.to);

      if (!from || !to) {
        return undefined;
      }

      return {
        from,
        to,
        conds: edge.conds
      };
    })
    .filter(
      (
        edge
      ): edge is {
        from: { x: number; y: number };
        to: { x: number; y: number };
        conds: Condition[];
      } => typeof edge !== "undefined"
    );

  return {
    positions: pos,
    edges,
    nodes: [...graph.instances.values()],
    maxLevel: Math.max(...nodes.map(n => n.level ?? 0), 0),
    rows: Math.max(1, Math.ceil(rowCursor))
  };
}

function el(tag: string, className?: string, text?: string | null) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}


  if (!window.DATA) {
    throw new VariableNotDefinedError('DATA');
  }
  if (!window.SEEN) {
    throw new VariableNotDefinedError('SEEN');
  }
  if (!window.SPRITES) {
    throw new VariableNotDefinedError('SPRITES');
  }
  if (!window.ACHIEVEMENTS) {
    throw new VariableNotDefinedError('ACHIEVEMENTS');
  }
  if (!window.ACHIEVED) {
    throw new VariableNotDefinedError('ACHIEVED');
  }

  const DATA = window.DATA;
  const SEEN = window.SEEN;
  const SPRITES = window.SPRITES;
  const ACHIEVEMENTS = window.ACHIEVEMENTS;
  const ACHIEVED = window.ACHIEVED;

  const petsById = new Map<PetId, Pet>(DATA.map(p => ([p.id, p])));
  const achievementsById = new Map<AchievementId, Achievement>(ACHIEVEMENTS.map(a => ([a.id, a])));

function render() {

  function formatConds(conds: Condition[]) {
    if (!conds || conds.length === 0) {
      return "";
    }

    return conds
      .map(c => {
        if (c.label) {
          return c.label;
        }

        if (isExperienceCondition(c)) {
          return c.exp;
        }

        if (isSeenCondition(c)) {
          const pets = c.seen.map(s => (SEEN.includes(s) || DISPLAY_HIDDEN) ? petsById.get(s)?.name : tCommon('unseen.name'));

          return pets.join(', ');
        }

        if (isAchievedCondition(c)) {
          const achievements = c.achieved
            // Only enabled achievements
            .filter(a =>  (achievementsById.get(a)?.conds?.length ?? 0) > 0)
            .map(s => (ACHIEVED.includes(s) || DISPLAY_HIDDEN) ? achievementsById.get(s)?.name : tCommon('unseen.name'));

          return achievements.join(', ');
        }

        return "";
      })
      .filter(Boolean)
      .join(" · ");
  }

  let filteredData = DATA;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    const matches = new Set(DATA.filter(node => {
      if (!DISPLAY_HIDDEN && !SEEN.includes(node.id)) {
        return false;
      }

      const name = node.name?.toLowerCase() ?? "";
      const idStr = node.id.toString();
      return name.includes(term) || idStr.includes(term);
    }).map(n => n.id));
    const byId = new Map<PetId, GraphNode>(
      DATA.map(n => [
        n.id,
        {
          ...n,
          evolutions: n.evolutions ?? []
        }
      ])
    );
    const incoming = new Map<PetId, number>();
    for (const node of byId.values()) {
      for (const evo of node.evolutions) {
        incoming.set(evo.target, (incoming.get(evo.target) ?? 0) + 1);
      }
    }
    const roots = [...byId.values()]
      .filter(n => !incoming.has(n.id))
      .sort(
        (a, b) =>
          (a.level ?? 0) - (b.level ?? 0) ||
          (a.name ?? "").localeCompare(b.name ?? "")
      );
    const filteredRoots = roots.filter(root => {
      const treeNodes = getTreeNodes(root.id, byId);
      return [...treeNodes].some(id => matches.has(id));
    });
    const relevant = new Set<PetId>();
    for (const root of filteredRoots) {
      markRelevant(root.id, byId, matches, relevant);
    }
    filteredData = Array.from(relevant).map(id => {
      const node = byId.get(id) as GraphNode;
      const filteredEvos = node.evolutions.filter(evo => relevant.has(evo.target));
      return {
        ...node,
        evolutions: filteredEvos
      };
    });
  }

  const board = document.getElementById("board");
  if (!board) {
    throw new ElementNotFoundError('#board');
  }

  const layout = layoutForest(filteredData);

  const COL_W = 220;
  const ROW_H = 110;
  const NODE_W = 168;
  const NODE_H = 72;
  const PAD = 20;

  const width = (layout.maxLevel + 1) * COL_W + PAD * 2;
  const height = layout.rows * ROW_H + PAD * 2;

  board.innerHTML = "";
  board.style.width = `${width * zoomLevel}px`;
  board.style.height = `${height * zoomLevel}px`;

  const headers = el("div", "headers");
  headers.style.gridTemplateColumns = `repeat(${layout.maxLevel + 1}, ${COL_W * zoomLevel}px)`;
  headers.style.width = `${width * zoomLevel}px`;

  const baseFont = 11;
  const basePadX = 10;
  const baseMinHeight = 28;
  for (let level = 0; level <= layout.maxLevel; level++) {

    const cell = el("div", "header");
    const pill = el(
      "div",
      "header-pill",
      tCommon(`levels.${level as PetLevel}`)
    );

    pill.style.fontSize = `${baseFont * zoomLevel}px`;
    pill.style.padding = `0 ${basePadX * zoomLevel}px`;
    pill.style.minHeight = `${baseMinHeight * zoomLevel}px`;
    cell.appendChild(pill);
    headers.appendChild(cell);
  }

  const canvas = el("div", "canvas");
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.transform = `scale(${zoomLevel})`;
  canvas.style.transformOrigin = 'top left';

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", "edges");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const defs = document.createElementNS(svgNS, "defs");
  const marker = document.createElementNS(svgNS, "marker");
  marker.setAttribute("id", "arrow");
  marker.setAttribute("viewBox", "0 0 10 10");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "5");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto");

  const arrowPath = document.createElementNS(svgNS, "path");
  arrowPath.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
  arrowPath.setAttribute("fill", "var(--link)");

  marker.appendChild(arrowPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  for (const edge of layout.edges) {
    const fromCenterX = PAD + edge.from.x * COL_W + NODE_W / 2;
    const fromCenterY = PAD + edge.from.y * ROW_H + NODE_H / 2;

    const toCenterX = PAD + edge.to.x * COL_W + NODE_W / 2;
    const toCenterY = PAD + edge.to.y * ROW_H + NODE_H / 2;

    const x1 = fromCenterX + NODE_W / 2;
    const y1 = fromCenterY;

    const x2 = toCenterX - NODE_W / 2;
    const y2 = toCenterY;

    const midX = x1 + (x2 - x1) * 0.5;

    const pathData = `
      M ${x1} ${y1}
      L ${midX} ${y1}
      L ${midX} ${y2}
      L ${x2} ${y2}
    `;

    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "var(--link)");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-opacity", "0.9");
    path.setAttribute("marker-end", "url(#arrow)");

    svg.appendChild(path);

    const condText = formatConds(edge.conds);
    if (condText) {
      const indicator = el("div", "edge-indicator", edge.conds.length === 1 ? '!' : String(edge.conds.length));
      indicator.style.left = `${midX}px`;
      indicator.style.top = `${(y1 + y2) / 2 - 16}px`;

      const tooltip = el("div", "edge-tooltip", condText);
      indicator.appendChild(tooltip);

      canvas.appendChild(indicator);
    }
  }

  const nodesLayer = el("div", "nodes");

  for (const instance of layout.nodes) {
    const node = instance.pet;
    const seen = DISPLAY_HIDDEN ? true : SEEN.includes(node.id);
    const p = layout.positions.get(instance.instanceId);

    if (!p) {
      continue;
    }

    const card = el("div", "node");
    card.style.left = `${PAD + p.x * COL_W + NODE_W / 2}px`;
    card.style.top = `${PAD + p.y * ROW_H + NODE_H / 2}px`;

    const carouselItems = [
      node,
      ...(node.variations ?? []).map(v => Object.assign({}, node, v))
    ];
    let currentIndex = 0;

    const shell = el("div", "sprite-shell");
    const sprite = el("div", "sprite");
    const updateSprite = () => {
      const currentItem = carouselItems[currentIndex];
      const spriteUrl = SPRITES[currentItem.id];
      if (spriteUrl) {
        if (!seen) {
          sprite.style.filter = "brightness(0)";
        }
        sprite.style.backgroundImage = `url("${spriteUrl}")`;
      } else {
        sprite.style.backgroundImage = '';
      }
    };
    updateSprite();

    shell.appendChild(sprite);

    let prevBtn: HTMLElement | undefined, nextBtn: HTMLElement | undefined;
    if (carouselItems.length > 1) {
      prevBtn = el("div", "carousel-btn prev", "‹");
      nextBtn = el("div", "carousel-btn next", "›");
      prevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + carouselItems.length) % carouselItems.length;
        updateSprite();
        updateName();
      });
      nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % carouselItems.length;
        updateSprite();
        updateName();
      });
      card.appendChild(nextBtn);
    }

    const meta = el("div", "meta");
    const nameDiv = el("div", "name", seen ? node.name : tCommon('unseen.name'));
    const updateName = () => {
      const currentItem = carouselItems[currentIndex];
      nameDiv.textContent = seen ? currentItem.name || tCommon('unseen.name') : tCommon('unseen.name');
    };
    updateName();
    meta.appendChild(nameDiv);
    meta.appendChild(el("div", "type", seen ? node.type : tCommon('unseen.type')));
    // meta.appendChild(el("div", "id", `#${node.id}`));

    if (prevBtn) {
      card.appendChild(prevBtn);
    }
    card.appendChild(shell);
    card.appendChild(meta);
    if (nextBtn) {
      card.appendChild(nextBtn);
    }

    card.addEventListener('click', () => {
      vscode.postMessage({
        type: OPEN_ENCYCLOPEDIA_ENTRY,
        petId: carouselItems[currentIndex].id,
      });
    });

    nodesLayer.appendChild(card);
  }

  canvas.appendChild(svg);
  canvas.appendChild(nodesLayer);

  board.appendChild(headers);
  board.appendChild(canvas);
}

render();

document.getElementById('zoom-out')?.addEventListener('click', () => {
  zoomLevel = Math.max(zoomLevel / 1.2, 0.5);
  render();
});

document.getElementById('zoom-in')?.addEventListener('click', () => {
  zoomLevel = Math.min(zoomLevel * 1.2, 2);
  render();
});

document.getElementById('search')?.addEventListener('input', (e) => {
  searchTerm = (e.target as HTMLInputElement).value;
  render();
});