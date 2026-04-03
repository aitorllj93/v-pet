

/**
 * A Sprite frame:
 * 0 = Top Left (Idle)
 * 1 = Top Right (Blink)
 * 2 = Bot Left (Skill)
 * 3 = Bot Right (KO)
 */
export type SpriteFrame = |
  0 |
  1 |
  2 |
  3;

export type AnimationFrame = {
  frame: SpriteFrame;
  fps: number;
  x?: number;
  y?: number;
  flipX?: boolean;
  flipY?: boolean;
}

export const IDLE = 'idle';
export const BLINK = 'blink';
export const BOUNCE = 'bounce';
export const ATTACK = 'attack';
export const CHEER = 'cheer';
export const SLEEP = 'sleep';
export const KO = 'ko';
export const WAKE_UP = 'wakeUp';
export const EVOLVE = 'evolve';

export type AnimationId = |
  typeof IDLE |
  typeof BLINK |
  typeof BOUNCE |
  typeof ATTACK |
  typeof CHEER |
  typeof SLEEP |
  typeof KO |
  typeof WAKE_UP |
  typeof EVOLVE;

export type Animation = {
  loop?: boolean;
  frames: AnimationFrame[];
}