import { Condition } from "./condition";

export const EGG = 0;
export const BABY_1 = 1;
export const BABY_2 = 2;
export const CHILD = 3;
export const ADULT = 4;
export const PERFECT = 5;
export const ULTIMATE = 6;
export const ULTIMATE_PLUS = 7;

/**
 * A Pet level:
 * 0 = Egg
 * 1 = Baby I
 * 2 = Baby II
 * 3 = Child
 * 4 = Adult
 * 5 = Perfect
 * 6 = Ultimate
 * 7 = Ultimate+
 */
export type PetLevel = |
  typeof EGG |
  typeof BABY_1 |
  typeof BABY_2 |
  typeof CHILD |
  typeof ADULT |
  typeof PERFECT |
  typeof ULTIMATE |
  typeof ULTIMATE_PLUS;

export type PetId = number;

export type Pet = {
  id: PetId;
  slug?: string;
  level: PetLevel;
  type?: string;
  attribute?: 'data' | 'vaccine' | 'virus';
  image?: string;
  name: string;
  description?: string;
  url?: string;
  evolutions?: Evolution[];
  variations?: Variation[];
  specialMoves?: string[];
  /** Evolution Conditions. Useful for variations */
  conds?: Condition[];
}

export type Evolution = {
  target: PetId;
  conds: Condition[];
}

export type Variation = Partial<Pet> & Pick<Pet, 'id' | 'name'>;