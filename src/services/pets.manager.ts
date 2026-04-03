

import { MissingEvolutionError, MissingIdError, MissingLevelError } from "../errors";
import { Achievement, AchievementId, EGG, PetLevel, type Pet, type PetId, type State } from "../types";
import { canEvolve, EvolutionCandidate } from '../utils/evolution';
import { ConfigManager } from './config.manager';

export class PetsManager {
  private allPetsAndVariations: Map<PetId, Pet> | undefined;
  private pets: Pet[] | undefined;
  private eggs: Pet[] | undefined;

  constructor(
    private config: ConfigManager,
  ) {}

  getPet(petId: PetId) {
    return this.allPetsAndVariations?.get(petId);
  }

  getPets() {
    if (!this.pets) {
      return [];
    }

    return this.pets;
  }

  getEggs() {
    if (!this.eggs) {
      return [];
    }

    return this.eggs;
  }

  evolve(pet: Pet | undefined, state: State, achievementsMap: Map<AchievementId, Achievement>): Pet | undefined {
    if (!this.allPetsAndVariations) {
      return undefined;
    }

    const config = this.config.getConfig();


    if (!pet?.evolutions?.length) {
      return undefined;
    }

    const requiredExperience = config.experience.evolutionConditions[(pet.level + 1) as PetLevel];

    if (state.experience < requiredExperience) {
      return undefined;
    }

    const candidates = canEvolve(pet, state, this.allPetsAndVariations, achievementsMap, config.excludePets);

    if (candidates.length === 0) {
      return undefined;
    }

    if (candidates.length === 1) {
      return candidates[0].pet;
    } 

    if (config.discoverMode) {
      // in discover mode, we always prioritize the candidate with higher chance
      return candidates.reduce<EvolutionCandidate | undefined>(
        (best, candidate) => {
          if (!best || candidate.chance > best.chance) {
            return candidate;
          }

          return best;
        },
        undefined
      )?.pet;
    }

    const roll = Math.random();
    let acc = 0;

    for (const candidate of candidates) {
      acc += candidate.chance;
      if (roll <= acc) {
        return candidate.pet;
      }
    }

    return undefined;
  }

  setPets(pets: Pet[]) {
    this.pets = pets;
    this.eggs = this.pets.filter(pet => pet.level === EGG);
    this.allPetsAndVariations = this.createPetMap(pets);
  }

  validate() {
    if (!this.allPetsAndVariations) {
      return true;
    }
    const pets = Array.from(this.allPetsAndVariations.values());

    for (const pet of pets) {
      if (!('id' in pet) || pet.id === undefined) {
        throw new MissingIdError(pet.name);
      }
      if (!('level' in pet) || pet.level === undefined) {
        throw new MissingLevelError(pet.id);
      }

      if (!pet.evolutions) {
        continue;
      }

      for (const evolution of pet.evolutions) {
        const evo = this.getPet(evolution.target);

        if (!evo) {
          throw new MissingEvolutionError(pet.id, evolution.target);
        }
      }
    }
  }

  private createPetMap(allPets: Pet[]): Map<PetId, Pet> {
    return new Map(allPets.flatMap((pet) => {
      if (!pet.variations) {
        return [
          [pet.id, pet]
        ];
      }
      const variations: [PetId, Pet][] = pet.variations.map(variation => ([
        variation.id,
        {
          ...pet,
          ...variation,
          evolutions: variation.evolutions ?? pet.evolutions,
          variations: []
        }
      ]));
      variations.push([pet.id, pet]);

      return variations;
    }));
  }
}