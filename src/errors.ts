import { PetId } from "./types";

export class MissingIdError extends Error {
  constructor(petName: string) {
    super(`Missing id in pet "${petName}"`);
  }
}

export class MissingLevelError extends Error {
  constructor(petId: PetId) {
    super(`Missing level in pet "${petId}"`);
  }
}

export class MissingEvolutionError extends Error {
  constructor(petId: PetId, target: PetId) {
    super(`Missing evolution in pet "${petId}" with target "${target}"`);
  }
}

export class StateNotLoadedError extends Error {
  constructor() {
    super('State is not loaded');
  }
}

export class VariableNotDefinedError extends Error {
  constructor(variable: string) {
    super(`Variable "${variable}" was not defined`);
  }
}

export class ElementNotFoundError extends Error {
  constructor(selector: string) {
    super(`Element with selector "${selector}" is not initialised`);
  }
}