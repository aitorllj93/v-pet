import type { PetId } from "../pet";

export const READY = 'ready';
export const EGG_SELECTED = 'eggSelected';
export const OPEN_ENCYCLOPEDIA_ENTRY = 'openEncyclopediaEntry';

export type ClientEvent = |
  typeof READY |
  typeof EGG_SELECTED |
  typeof OPEN_ENCYCLOPEDIA_ENTRY;

export type ViewReadyMessage = {
  type: typeof READY;
}

export type EggSelectedMessage = {
  type: typeof EGG_SELECTED;
  petId: PetId;
}

export type OpenEncyclopediaEntryMessage = {
  type: typeof OPEN_ENCYCLOPEDIA_ENTRY;
  petId: PetId;
}

export type ClientMessage = ViewReadyMessage | EggSelectedMessage | OpenEncyclopediaEntryMessage;
