import { ElementNotFoundError, VariableNotDefinedError } from "../../../errors";
import { useTranslation } from "../../../i18n/use-translation";
import { Achievement, AchievementId, isAchievedCondition, isExperienceCondition, isSeenCondition, OpenEncyclopediaEntryMessage, type Condition, type Pet, type PetId } from "../../../types";

declare global {
  interface Window {
    DATA?: Pet[];
    ACHIEVEMENTS?: Achievement[];
    SEEN?: PetId[];
    SELECTED?: PetId;
    ACHIEVED?: AchievementId[];
    SPRITES?: Record<PetId, string>;
    acquireVsCodeApi: () => {
      postMessage(data: unknown): void;
      setState(data: unknown): void;
      getState(): unknown;
    }
  }
}

const DISPLAY_HIDDEN = false;
const CONTAINER_SELECTOR = "#board > .encyclopedia";

const { t: tCommon } = useTranslation('common');
const { t } = useTranslation('encyclopedia');

let searchTerm = "";
let selectedId: PetId | null = window.SELECTED ?? null;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string | null
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

function prepareData(data: Pet[]) {
  const results: Pet[] = [];

  for (const pet of data) {
    results.push(pet);
    if (!pet.variations) {
      continue;
    }

    for (const variation of pet.variations) {
      results.push(Object.assign({}, pet, variation, { 
        evolutions: [...(pet.evolutions ?? [])],
        variations: [] 
      }));

      const sources = results.filter(p => p.evolutions?.some(evo => evo.target === pet.id));
      for (const source of sources) {
        const evolution = source.evolutions?.find(evo => evo.target === variation.id);
        if (evolution) {
          continue;
        }

        const originalEvolution = source.evolutions?.find(evo => evo.target === pet.id);
        source.evolutions?.push({
          target: variation.id,
          conds: [
            ...(originalEvolution?.conds ?? []),
            ...(pet.conds ?? []),
            ...(variation.conds ?? [])
          ]
        });
      }
    }
  }

  results.sort((a, b) => a.id - b.id);

  return results;
}


if (!window.DATA) {
  throw new VariableNotDefinedError("DATA");
}
if (!window.ACHIEVEMENTS) {
  throw new VariableNotDefinedError("ACHIEVEMENTS");
}
if (!window.ACHIEVED) {
  throw new VariableNotDefinedError("ACHIEVED");
}
if (!window.SEEN) {
  throw new VariableNotDefinedError("SEEN");
}
if (!window.SPRITES) {
  throw new VariableNotDefinedError("SPRITES");
}

const DATA = prepareData(window.DATA);

const ACHIEVEMENTS = window.ACHIEVEMENTS;
const ACHIEVED = window.ACHIEVED;
const SEEN = window.SEEN;
const SPRITES = window.SPRITES;

const byId = new Map<PetId, Pet>(DATA.map(p => ([p.id, p])));
const achievementsById = new Map<AchievementId, Achievement>(ACHIEVEMENTS.map(a => ([a.id, a])));

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
        const pets = c.seen.map(s => (SEEN.includes(s) || DISPLAY_HIDDEN) ? byId.get(s)?.name : tCommon('unseen.name'));

        return pets.join(', ');
      }

      if (isAchievedCondition(c)) {
        const achievements = c.achieved
          // Only enabled achievements
          .filter(a =>  (achievementsById.get(a)?.conds?.length ?? 0) > 0)
          .map(a => (ACHIEVED.includes(a) || DISPLAY_HIDDEN) ? achievementsById.get(a)?.name : tCommon('unseen.name'));

        return achievements.join(', ');
      }

      return "";
    })
    .filter(Boolean)
    .join(" · ");
}

function activateItemOnList(selected: PetId | null) {
  const root = document.querySelector(CONTAINER_SELECTOR);

  if (!root) {
    throw new ElementNotFoundError(CONTAINER_SELECTOR);
  }

  const listItems = root.querySelectorAll(".encyclopedia-list-item");

  for (const item of listItems) {
    const isSelected = item.id === `list-${selected}`;

    if (isSelected) {
      if (!item.classList.contains('selected')) {
        item.classList.add('selected');
      }
    } else {
      item.classList.remove('selected');
    }
  }
}

function selectPet(petId: PetId | null) {
  selectedId = petId;
  renderDetail(petId);
  activateItemOnList(petId);

  const listScroll = document.querySelector(".encyclopedia-list-scroll");
  if (listScroll) {
    const inList = listScroll.querySelector(`#list-${petId}`);
    if (inList) {
      inList.scrollIntoView({
        behavior: 'smooth'
      });
    }
  }
}

function renderContainer() {
  const board = document.getElementById("board");
  if (!board) {
    throw new ElementNotFoundError('#board');
  }

  let root = board.querySelector(".encyclopedia");

  if (!root) {
    root = el("div", "encyclopedia");
    board.appendChild(root);
  }
}

function renderList(data: Pet[]) {
  const root = document.querySelector("#board > .encyclopedia");

  if (!root) {
    throw new ElementNotFoundError(CONTAINER_SELECTOR);
  }

  let listPanel = root.querySelector('.encyclopedia-list');

  if (listPanel) {
    listPanel.innerHTML = "";
  } else {
    listPanel = el("div", "encyclopedia-list");
    root.appendChild(listPanel);
  }

  const listScroll = el("div", "encyclopedia-list-scroll");

  for (const pet of data) {
    const seen = DISPLAY_HIDDEN ? true : SEEN.includes(pet.id);
    const isSelected = selectedId === pet.id;

    const item = el(
      "button",
      [
        "encyclopedia-list-item",
        seen ? "seen" : "unseen",
        isSelected ? "selected" : ""
      ]
        .filter(Boolean)
        .join(" ")
    );

    item.id = `list-${pet.id}`;
    item.type = "button";
    item.addEventListener("click", () => {
      selectPet(pet.id);
    });

    const shell = el("div", "sprite-shell small");
    const sprite = el("div", "sprite");
    const spriteUrl = SPRITES[pet.id];
    if (spriteUrl) {
      sprite.style.backgroundImage = `url("${spriteUrl}")`;
      if (!seen) {
        sprite.style.filter = "brightness(0)";
      }
    }
    shell.appendChild(sprite);

    const meta = el("div", "encyclopedia-list-meta");
    const nameRow = el("div", "meta-name");
    nameRow.appendChild(
      el("span", "name", `${seen ? pet.name : tCommon('unseen.name')}`)
    );
    nameRow.appendChild(
      el("span", "id", `#${pet.id.toString().padStart(4, '0')}`)
    );
    const sub = el(
      "div",
      "meta-line",
      [
        tCommon(`levels.${pet.level}`),
        pet.attribute ? seen ? pet.attribute : tCommon('unseen.attribute') : ""
      ]
        .filter(Boolean)
        .join(" · ")
    );
    meta.appendChild(nameRow);
    meta.appendChild(sub);

    item.appendChild(shell);
    item.appendChild(meta);

    listScroll.appendChild(item);
  }

  listPanel.appendChild(listScroll);
}

function renderDetail(petId: PetId | null) {
  const root = document.querySelector("#board > .encyclopedia");

  if (!root) {
    throw new ElementNotFoundError(CONTAINER_SELECTOR);
  }


  let detailPanel = root.querySelector('.encyclopedia-detail');

  if (detailPanel) {
    detailPanel.innerHTML = "";
  } else {
    detailPanel = el("div", "encyclopedia-detail");
    root.appendChild(detailPanel);
  }

  if (petId === null || !byId.has(petId)) {
    const empty = el(
      "div",
      "encyclopedia-detail-empty",
      t('empty'),
    );
    detailPanel.appendChild(empty);
    return;
  }
  
  const pet = byId.get(petId) as Pet;
  const seen = DISPLAY_HIDDEN ?  true : SEEN.includes(pet.id);

  const header = el("div", "encyclopedia-detail-header");
  const title = el("div", "encyclopedia-detail-title", seen ? pet.name : tCommon('unseen.name'));
  const id = el("div", "encyclopedia-detail-id", `#${pet.id}`);
  header.appendChild(title);
  header.appendChild(id);

  const badgeRow = el("div", "encyclopedia-detail-badges");
  if (pet.level) {
    badgeRow.appendChild(el("span", "badge", tCommon(`levels.${pet.level}`)));
  }
  if (pet.attribute) {
    badgeRow.appendChild(el("span", "badge", seen ? pet.attribute : tCommon('unseen.attribute')));
  }
  if (pet.type) {
    badgeRow.appendChild(el("span", "badge muted", seen ? pet.type : tCommon('unseen.type')));
  }

  const body = el("div", "encyclopedia-detail-body");

  const spriteCol = el("div", "encyclopedia-detail-sprite");
  const bigShell = el("div", "sprite-shell large");
  const bigSprite = el("div", "sprite");
  const spriteUrl = SPRITES[pet.id];
  if (spriteUrl) {
    bigSprite.style.backgroundImage = `url("${spriteUrl}")`;
    if (!seen) {
      bigSprite.style.filter = "brightness(0)";
    }
  }
  bigShell.appendChild(bigSprite);
  spriteCol.appendChild(bigShell);

  const infoCol = el("div", "encyclopedia-detail-info");

  if (pet.description) {
    const descriptionRow = el("div", "encyclopedia-detail-info-section");
    descriptionRow.appendChild(el("div", "encyclopedia-detail-section-title", t('description')));
    descriptionRow.appendChild(el("p", "encyclopedia-detail-description", seen ? pet.description : tCommon('unseen.description')));
    infoCol.appendChild(descriptionRow);
  }

  if (pet.specialMoves && pet.specialMoves.length > 0) {
    const movesRow = el("div", "encyclopedia-detail-info-section");
    movesRow.appendChild(
      el("div", "encyclopedia-detail-section-title", t('specialMoves'))
    );
    const moves = el("div", "encyclopedia-detail-tags");
    for (const move of pet.specialMoves) {
      moves.appendChild(el("span", "tag", seen ? move : tCommon('unseen.move')));
    }
    movesRow.appendChild(moves);
    infoCol.appendChild(movesRow);
  }

  let evolvesFrom = DATA.filter(p => p.evolutions?.some(evo => evo.target === pet.id));

  if (!evolvesFrom || evolvesFrom.length === 0) {
    const variantOf = DATA.find(p => p.variations?.some(v => v.id === pet.id));
    if (variantOf) {      
      evolvesFrom = DATA.filter(p => p.evolutions?.some(evo => evo.target === variantOf.id));
    }
  }

  if (evolvesFrom && evolvesFrom.length > 0) {
    const fromRow = el("div", "encyclopedia-detail-info-section");
    fromRow.appendChild(
      el("div", "encyclopedia-detail-section-title", t('evolvesFrom'))
    );
    const fromList = el("div", "encyclopedia-detail-evolutions");
    for (const prev of evolvesFrom) {
      const evo = prev.evolutions?.find(evo => evo.target === pet.id);
      const labelParts: string[] = [];
      const seen = DISPLAY_HIDDEN ? true : SEEN.includes(prev.id);
      labelParts.push(seen ? prev.name : tCommon('unseen.name'));

      const evoEl = el("div", "evolution-line");
      const evoLabel = el("div", "evolution-label", seen ? labelParts.join(" · ") : tCommon('unseen.evolution'));
      evoEl.appendChild(evoLabel);

      if (evo) {
        // const conds = (evo.conds ?? []).concat(pet.conds ?? []);
        const condText = formatConds(evo.conds);
        if (condText) {
          const indicator = el("div", "evolution-indicator", evo.conds.length === 1 ? '!' : String(evo.conds.length));

          const tooltip = el("div", "evolution-tooltip", condText);
          indicator.appendChild(tooltip);

          evoEl.appendChild(indicator);
        }
      }

      evoEl.addEventListener("click", () => {
        selectPet(prev.id);
      });
      fromList.appendChild(
        evoEl
      );
    }
    fromRow.appendChild(fromList);
    infoCol.appendChild(fromRow);

  }

  function createEvolutionLine(target: Pet, conditions: Condition[] = []) {
    const labelParts: string[] = [];
    if (target) {
      const seen = DISPLAY_HIDDEN ? true : SEEN.includes(target.id);
      labelParts.push(seen ? target.name : tCommon('unseen.name'));
    } else {
      labelParts.push(`#${target}`);
    }

    const evoEl = el("div", "evolution-line");
    const evoLabel = el("div", "evolution-label", seen ? labelParts.join(" · ") : tCommon('unseen.evolution'));
    evoEl.appendChild(evoLabel);

    // const conds = (conditions ?? []).concat(target?.conds ?? []);
    const condText = formatConds(conditions);
    if (condText) {
      const indicator = el("div", "evolution-indicator", conditions.length === 1 ? '!' : String(conditions.length));

      const tooltip = el("div", "evolution-tooltip", condText);
      indicator.appendChild(tooltip);

      evoEl.appendChild(indicator);
    }

    evoEl.addEventListener("click", () => {
      selectPet(target!.id);
    });

    return evoEl;
  }

  if (pet.evolutions && pet.evolutions.length > 0) {
    const evoRow = el("div", "encyclopedia-detail-info-section");
    evoRow.appendChild(
      el("div", "encyclopedia-detail-section-title", t('evolvesTo'))
    );
    const evoList = el("div", "encyclopedia-detail-evolutions");
    for (const evo of pet.evolutions) {
      const target = byId.get(evo.target);

      if (!target) {
        continue;
      }


      evoList.appendChild(createEvolutionLine(target, evo.conds));
    }
    evoRow.appendChild(evoList);
    infoCol.appendChild(evoRow);
  }

  body.appendChild(spriteCol);
  body.appendChild(infoCol);

  detailPanel.appendChild(header);
  detailPanel.appendChild(badgeRow);
  detailPanel.appendChild(body);
}

function render() {
  let filtered = DATA;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = DATA.filter(pet => {
      if (!DISPLAY_HIDDEN && !SEEN.includes(pet.id)) {
        return false;
      }

      const name = pet.name?.toLowerCase() ?? "";
      const idStr = pet.id.toString();
      return name.includes(term) || idStr.includes(term);
    });
  }

  if (!selectedId || !byId.has(selectedId)) {
    selectedId = filtered[0]?.id ?? null;
  }

  renderContainer();
  renderList(filtered);
  renderDetail(selectedId);
}

render();

document.getElementById("search")?.addEventListener("input", (e) => {
  searchTerm = (e.target as HTMLInputElement).value;
  render();
});



window.addEventListener("message", async ({ data: msg }: MessageEvent<OpenEncyclopediaEntryMessage>) => {
  selectPet(msg.petId);
});