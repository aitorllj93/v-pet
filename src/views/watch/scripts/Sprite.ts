

import { type Animation, type AnimationId, IDLE } from "../../../types";

export const FRAME_SIZE = 16;   // px of the original spritesheet
export const SPRITE_FRAMES = [
  { x: 0, y: 0 },
  { x: FRAME_SIZE, y: 0 },
  { x: 0, y: FRAME_SIZE },
  { x: FRAME_SIZE, y: FRAME_SIZE },
];

export const ANIMATIONS: Record<AnimationId, Animation> = {
  idle: {
    loop: true,
    frames: [{ frame: 0, fps: 2 }, { frame: 1, fps: 2 }]
  },
  blink: {
    frames: [{ frame: 0, fps: 10 }, { frame: 1, fps: 1 }, { frame: 0, fps: 10 }]
  },
  bounce: {
    frames: [{ frame: 0, fps: 4 }, { frame: 0, fps: 4, y: -1 }, { frame: 1, fps: 4 }, { frame: 0, fps: 4, y: 1 }]
  },
  attack: {
    frames: [{ frame: 0, fps: 3 }, { frame: 2, fps: 2 }, { frame: 0, fps: 6 }]
  },
  cheer: {
    frames: [{ frame: 0, fps: 3 }, { frame: 2, fps: 3 }, { frame: 0, fps: 3 }, { frame: 2, fps: 3 }]
  },
  sleep: {
    loop: true,
    frames: [{ frame: 3, fps: 2 }]
  },
  ko: {
    loop: true,
    frames: [{ frame: 3, fps: 12 }, { frame: 3, fps: 12, y: 1 }]
  },
  wakeUp: {
    frames: [{ frame: 3, fps: 6 }, { frame: 2, fps: 3 }, { frame: 0, fps: 6 }]
  },
  evolve: {
    frames: [
      { frame: 0, fps: 12 },
      { frame: 0, fps: 12, flipX: true },
      { frame: 0, fps: 12 },
      { frame: 0, fps: 12, flipX: true },
      { frame: 0, fps: 12 },
      { frame: 0, fps: 12, flipX: true },
      { frame: 0, fps: 12 },
      { frame: 0, fps: 12, flipX: true },
    ]
  }
};

export class Sprite {
  img: HTMLImageElement;

  x: number;
  y: number;
  scale: number;
  flipX: false;
  animationId: AnimationId;
  idleAnimationId: AnimationId;
  framePos: number;
  acc: number;
  hoverPhase = 0;

  constructor(
    img: HTMLImageElement,
    x: number,
    y: number,
    animationId: AnimationId,
    scale?: number,
  ) {
    this.img = img;
    this.x = x;
    this.y = y;
    this.scale = scale ?? 1;
    this.flipX = false;

    this.animationId = animationId;
    this.idleAnimationId = IDLE;
    this.framePos = 0;
    this.acc = 0;
  }

  setIdleAnimationId(animationId: AnimationId) {
    this.idleAnimationId = animationId;
  }

  play(animationId: AnimationId) {
    if (this.animationId === animationId) {
      return;
    }
    this.animationId = animationId;
    this.framePos = 0;
    this.acc = 0;
  }

  update(dtMs: number, isHovered = false) {
    const anim = ANIMATIONS[this.animationId];
    const frame = anim.frames[this.framePos];
    const frameDuration = 1000 / frame.fps;


    if (isHovered) {
      this.hoverPhase += 1;
    } else {
      this.hoverPhase = 0;
    }

    this.acc += dtMs;
    while (this.acc >= frameDuration) {
      this.acc -= frameDuration;
      this.framePos++;

      if (this.framePos >= anim.frames.length) {
        if (anim.loop) {
          this.framePos = 0;
        } else {
          this.play(this.idleAnimationId);
        };
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, isHovered: boolean) {
    const frame = ANIMATIONS[this.animationId].frames[this.framePos];
    const { x, y } = SPRITE_FRAMES[frame.frame];

    const dw = FRAME_SIZE * this.scale;
    const dh = FRAME_SIZE * this.scale;
    const hoverOffsets = [0, -1, -2, -1];
    const bounce = 0; // isHovered
    //   ? hoverOffsets[this.hoverPhase % hoverOffsets.length]
    //   : 0;

    const ox = frame.x ?? 0;
    const oy = frame.y ?? 0;

    // Flip sin recalcular spritesheets: transform local
    ctx.save();
    ctx.translate(
      this.x + ox * this.scale,
      this.y + (oy + bounce) * this.scale
    );

    // if (isHovered) {
    //   ctx.globalAlpha = 0.2;
    // }

    if (frame.flipX) {
      ctx.scale(-1, 1);
      ctx.drawImage(this.img, x, y, FRAME_SIZE, FRAME_SIZE, -dw, 0, dw, dh);
    } else {
      ctx.drawImage(this.img, x, y, FRAME_SIZE, FRAME_SIZE, 0, 0, dw, dh);
    }
    // ctx.globalAlpha = 1;

    ctx.restore();
  }
}