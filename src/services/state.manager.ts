
import type * as vscode from 'vscode';

import { Achievement, DEFAULT_STATE, EGG, PetLevel, type PetId, type State } from '../types';
import { ConfigManager } from './config.manager';
import { PetsManager } from './pets.manager';
import { STATE_KEY } from '../constants';
import { StateNotLoadedError } from '../errors';

function getTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class StateManager {

  private state: State | undefined;

  constructor(
    private config: ConfigManager,
    private pets: PetsManager,
    private ctx: vscode.ExtensionContext
  ) {
    this.loadState();
  }

  addExp(exp: number) {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    this.state.experience = this.state.experience + exp;
    this.persistState();
  }

  addAchievements(achievements: Achievement[]) {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    this.state.achievements = [
      ...this.state.achievements,
      ...achievements.map(a => a.id)
    ];
    this.persistState();
  }

  setPet(petId: PetId, petLevel: PetLevel) {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    this.state.petId = petId;
    if (!this.state.seenPets.includes(petId)) {
      this.state.seenPets.push(petId);
    }
    if (petLevel === EGG) {
      this.state.experience = 0;
      this.state.lastPetAssignedDate = getTodayStr();
    }
    this.persistState();
  }

  clearPet() {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    this.state.petId = null;
    this.state.experience = 0;
    this.persistState();
  }

  ensurePetForToday(): State {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    const today = getTodayStr();

    if (this.state.lastPetAssignedDate !== today) {

      const config = this.config.getConfig();

      let petId = null;
      if (config.randomEggs) {
        const eggs = this.pets.getEggs();
        const picked = eggs[Math.floor(Math.random() * eggs.length)];
        petId = picked.id;
      }

      this.state.petId = petId;
      this.state.experience = 0;
      this.persistState();
    }

    return this.state;
  }

  get() {
    if (!this.state) {
      throw new StateNotLoadedError();
    }

    return this.state;
  }

  loadState() {
    if (this.state) {
      return;
    }

    const stored = this.ctx.workspaceState.get<State | undefined>(STATE_KEY);

    if (!stored) {
      this.state = DEFAULT_STATE;
      return;
    }

    const achievements = Array.isArray(stored.achievements) ? stored.achievements : [];
    const seenPets = Array.isArray(stored.seenPets) ? stored.seenPets : [];

    this.state = {
      petId: typeof stored.petId !== 'undefined' ? stored.petId : null,
      experience: typeof stored.experience === 'number' ? stored.experience : 0,
      experienceByAction: typeof stored.experienceByAction === 'object' ? stored.experienceByAction : {},
      experienceByKind: typeof stored.experienceByKind === 'object' ? stored.experienceByKind : {
        data: 0,
        vaccine: 0,
        virus: 0
      },
      achievements,
      seenPets,
      lastPetAssignedDate:
        typeof (stored as State).lastPetAssignedDate === 'string'
          ? (stored as State).lastPetAssignedDate
          : null,
    };
  }

  persistState() {
    this.ctx.workspaceState.update(STATE_KEY, this.state);
  }

  resetState() {
    this.state = DEFAULT_STATE;
    this.persistState();
  }
}