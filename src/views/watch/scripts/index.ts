
const ID_TPL_VARIABLE = '__id__';
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 180;
const ZOOM = 3;
const TICK = 1000 / 12; // 83.333 ms

import {
  BOUNCE,
  CHEER,
  type ClientMessage,
  DEFAULT_STATE,
  EVOLVE,
  IDLE,
  type Pet,
  type ServerMessage,
  SLEEP,
  type State
} from "../../../types";

import { FRAME_SIZE, Sprite } from "./Sprite";

declare global {
  interface Window {
    SPRITES_URL_TPL?: string;
    acquireVsCodeApi: () => {
      postMessage(data: unknown): void;
      setState(data: unknown): void;
      getState(): unknown;
    }
  }
}

const vscode = acquireVsCodeApi();

const loadSprite = (
  spritesUrlTpl: string,
  pet: Pet | null
): Promise<HTMLImageElement> => {
  const src = pet ? spritesUrlTpl.replace(ID_TPL_VARIABLE, getFileName(pet)) : null;
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (!src) {
      resolve(img);
      return;
    }
    
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const getFileName = (pet: Pet) => {
  return `${pet.id.toString().padStart(4, '0')}`;
};

let isHovered = false;
let uiAlpha = 0;

const speed = 0.15;

const resize = () => {
  const canvas = document.querySelector("#watch canvas") as HTMLCanvasElement;
  if (!canvas) {
    return;
  }

  const container = canvas.parentElement?.parentElement as HTMLElement;
  
  const scale = Math.min(
    container.clientWidth / CANVAS_WIDTH,
    container.clientHeight / CANVAS_HEIGHT
  );

  // dpr = window.devicePixelRatio || 1;

  canvas.style.width = `${CANVAS_WIDTH * scale}px`;
  canvas.style.height = `${CANVAS_HEIGHT * scale}px`;

  // canvas.width = Math.round(CANVAS_WIDTH * dpr);
  // canvas.height = Math.round(CANVAS_HEIGHT * dpr);
};

function drawPixelText(
  ctx: CanvasRenderingContext2D,
   text: string, 
   x: number, 
   y: number, 
   color: string,
   fillColor: string,
) {
  ctx.fillStyle = fillColor;
  ctx.fillText(text, x-1, y);
  ctx.fillText(text, x+1, y);
  ctx.fillText(text, x, y-1);
  ctx.fillText(text, x, y+1);

  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function fitText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  };

  let out = value;
  while (out.length > 0 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

function drawXp(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  xp: number,
  pet: Pet,
) {
  if (isHovered) {
    uiAlpha = Math.min(uiAlpha + speed, 1);
  } else {
    uiAlpha = Math.max(uiAlpha - speed, 0);
  }
  
  const canvas = document.querySelector("#watch canvas") as HTMLCanvasElement;
  const text = `${xp}`;

  // const x = sprite.x + (FRAME_SIZE * ZOOM);
  const y = sprite.y;

  ctx.save();

  const padY = 1;

  const styles = getComputedStyle(document.documentElement);
  const color = styles.getPropertyValue("--vscode-editor-background").trim();
  const fillColor = styles.getPropertyValue("--vscode-foreground").trim();

  const padRight = 4;

  // ✅ convierte el borde derecho del canvas a “world units”
  const t = ctx.getTransform();
  const sx = t.a || 1; // si tu setTransform era (ZOOM,0,0,ZOOM,0,0) => sx=ZOOM
  const rightEdge = (canvas.width / sx) - padRight;

  // const leftLimit = x - 20;
  const maxWidth = 999; // rightEdge - leftLimit;

  ctx.globalAlpha = uiAlpha;

  ctx.fillStyle = color;
  ctx.font = "6px 'Pixel Digivolve Italic'";
  ctx.fontKerning = "none";
  ctx.textBaseline = "top";
  ctx.textAlign = "right";

  if (maxWidth > 0) {
    const name = fitText(ctx, pet.name ?? "", maxWidth);
    const counter = text.padStart(3, "0");

    drawPixelText(ctx, name, rightEdge, y + padY, color, fillColor);
    drawPixelText(ctx, counter, rightEdge, y + padY + 8, color, fillColor);
  }

  ctx.restore();
}

const main = async () => {
  await document.fonts.load("12px 'Pixel Digivolve Italic'");
  if (!window.SPRITES_URL_TPL) {
    throw new Error('Variable "SPRITES_URL" was not defined');
  }

  const spritesUrl = window.SPRITES_URL_TPL;

  const state: State = {
    ...DEFAULT_STATE,
    petId: null,
  };

  let pet: Pet | null = null;

  const container = document.querySelector('#watch') as HTMLElement;
  if (!container) {
    throw new Error('Root element with id "watch" was not found');
  }

  const petViewWrapper = container.querySelector("#watch-pet-view") as HTMLElement;

  const canvas = document.createElement("canvas");
  petViewWrapper.appendChild(canvas);
  container.appendChild(petViewWrapper);

  let eggs: Pet[] = [];
  let carouselIndex = 0;
  const carouselEl = container.querySelector('#watch-carousel') as HTMLElement;
  const carouselSpriteEl = container.querySelector('.sprite') as HTMLElement;
  const center = container.querySelector('.watch-carousel-center') as HTMLElement;
  const leftBtn = container.querySelector(".watch-carousel-arrow-left") as HTMLElement;
  const rightBtn = container.querySelector(".watch-carousel-arrow-right") as HTMLElement;

  leftBtn.addEventListener("click", () => {
    if (eggs.length <= 1) {
      return;
    };
    carouselIndex = (carouselIndex - 1 + eggs.length) % eggs.length;
    updateCarouselDisplay();
  });
  rightBtn.addEventListener("click", () => {
    if (eggs.length <= 1) {
      return;
    };
    carouselIndex = (carouselIndex + 1) % eggs.length;
    updateCarouselDisplay();
  });
  center.addEventListener("click", () => {
    if (eggs.length === 0) {
      return;
    };
    const selected = eggs[carouselIndex];
    vscode.postMessage({ type: "eggSelected", petId: selected.id } as ClientMessage);
  });

  function getSpriteSrc(pet: Pet): string {
    if (!window.SPRITES_URL_TPL) {
      return "";
    };
    return window.SPRITES_URL_TPL.replace(ID_TPL_VARIABLE, getFileName(pet));
  }

  function updateCarouselDisplay() {
    if (!carouselEl || !carouselSpriteEl || eggs.length === 0) {
      return;
    };
    const egg = eggs[carouselIndex];
    carouselSpriteEl.style.backgroundImage = `url("${getSpriteSrc(egg)}")`;
    
    const leftArrow = carouselEl.querySelector(".watch-carousel-arrow-left") as HTMLElement;
    const rightArrow = carouselEl.querySelector(".watch-carousel-arrow-right") as HTMLElement;
    if (leftArrow) {
      leftArrow.style.visibility = eggs.length > 1 ? "visible" : "hidden";
    }
    if (rightArrow) {
      rightArrow.style.visibility = eggs.length > 1 ? "visible" : "hidden";
    }
  }

  function setCarouselVisible(visible: boolean) {
    if (carouselEl) {
      carouselEl.classList.toggle("watch-carousel-visible", visible);
    }
    petViewWrapper.classList.toggle("watch-pet-view-hidden", visible);
  }

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();

    const mouseX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const mouseY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const t = ctx.getTransform();
    const sx = t.a || 1;
    const sy = t.d || 1;

    const worldX = mouseX / sx;
    const worldY = mouseY / sy;

    const spriteX = sprite.x;
    const spriteY = sprite.y;
    const spriteW = FRAME_SIZE * sprite.scale;
    const spriteH = FRAME_SIZE * sprite.scale;

    isHovered =
      worldX >= spriteX &&
      worldX <= spriteX + spriteW &&
      worldY >= spriteY &&
      worldY <= spriteY + spriteH;
  });

  canvas.addEventListener("mouseleave", () => {
    isHovered = false;
  });

  window.addEventListener("resize", resize);
  resize();

  const ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D;
  ctx.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);

  if (!ctx) {
    throw new Error('Failed getting context from canvas');
  }
  ctx.imageSmoothingEnabled = false;

  const image = await loadSprite(window.SPRITES_URL_TPL, pet);
  const sprite = new Sprite(image, 20, 0, IDLE, ZOOM);

  let last = performance.now();
  let acc = 0;

  function frame(now: number) {
    const dt = now - last;
    last = now;

    acc += dt;

    // update only when hits tick
    while (acc >= TICK) {
      sprite.update(TICK, isHovered);
      acc -= TICK;
    }

    // Render (cleanup)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pet) {
      sprite.draw(ctx, isHovered);
      drawXp(
        ctx, 
        sprite, 
        state.experience,
        pet
      );
    }

    // // Important: if later want to draw UI, reset the zoom
    // ctx.setTransform(1, 0, 0, 1, 0, 0);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  window.addEventListener("message", async ({ data: msg }: MessageEvent<ServerMessage>) => {
    if (
      msg.type === "terminalTestsPassed" ||
      msg.type === "diagnosticsChanged" ||
      msg.type === "gitCommit" ||
      msg.type === "gitMerge" ||
      msg.type === "gitBranchCreated"
    ) {
      sprite.play(CHEER);
      return;
    }

    if (msg.type === "fileSaved") {
      sprite.play(BOUNCE);
      return;
    }

    if (msg.type === "experienceAdded") {
      state.experience = msg.data;
    }

    if (msg.type === "petLoaded") {
      pet = msg.data;
      sprite.img = await loadSprite(spritesUrl, pet);
    }

    if (msg.type === "petAwake") {
      sprite.setIdleAnimationId(IDLE);
    }

    if (msg.type === "petSleep") {
      sprite.setIdleAnimationId(SLEEP);
    }

    if (msg.type === "petEvolved") {
      pet = msg.data;
      const image = await loadSprite(spritesUrl, pet);
      sprite.play(EVOLVE);
      setTimeout( () => {
        sprite.img = image;
      }, 1000);
    }

    if (msg.type === "stateChanged") {
      Object.assign(state, msg.data);
      if (state.petId !== null) {
        setCarouselVisible(false);
      } else if (eggs.length > 0) {
        setCarouselVisible(true);
      }
    }

    if (msg.type === "eggsAvailable") {
      eggs = msg.data ?? [];
      carouselIndex = 0;
      updateCarouselDisplay();
      setCarouselVisible(true);
    }

    if (msg.type === "lcdFilterChanged") {
      container.classList.forEach(c => container.classList.remove(c));
      container.classList.add(`filter-${msg.data}`);
    }
  });
};

main()
  .catch(err => console.error('Error:', err))
  .then(() => vscode.postMessage<ClientMessage>({
    type: "ready"
  }));
