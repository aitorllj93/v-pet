import { AchievementId } from "./achievement";
import type { PetId } from "./pet";


export type State = {
  petId: PetId | null;
  experience: number;
  experienceByKind: {
    data: number;
    vaccine: number;
    virus: number;
  };
  experienceByAction: {

  };
  seenPets: PetId[];
  achievements: AchievementId[];
  lastPetAssignedDate: string | null;
}

export const DEFAULT_STATE: State = {
  petId: null,
  experience: 0,
  experienceByAction: {},
  experienceByKind: {
    data: 0,
    vaccine: 0,
    virus: 0
  },
  seenPets: [],
  achievements: [],
  lastPetAssignedDate: null,
};