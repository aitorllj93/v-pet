

import { Achievement } from '../achievement';
import type { LCDFilter } from '../config';
import type { Pet } from '../pet';
import type { State } from '../state';

export {
  ACTIVE,
  NAVIGATION,
  NAVIGATION_COMMAND,
  TERMINAL_COMMAND_EXECUTED,
  TERMINAL_TESTS_PASSED,
  DIAGNOSTICS_CHANGED,
  GIT_COMMIT,
  GIT_BRANCH_CREATED,
  GIT_MERGE,
  FILE_CHANGED,
  FILE_SAVED
} from './tracking';

export type {
  ActiveMessage,
  NavigationMessage,
  TerminalCommandMessage,
  DiagnosticsChangedMessage,
  GitRepositoryChangedMessage,
  FileChangedMessage,
  FileSavedMessage,
  TrackingEvent,
  TrackingMessage,
} from './tracking';

import type { TrackingMessage } from './tracking';

export const EXPERIENCE_ADDED = 'experienceAdded';
export const PET_AWAKE = 'petAwake';
export const PET_SLEEP = 'petSleep';
export const PET_LOADED = 'petLoaded';
export const PET_EVOLVED = 'petEvolved';
export const STATE_CHANGED = 'stateChanged';
export const EGGS_AVAILABLE = 'eggsAvailable';
export const LCD_FILTER_CHANGED = 'lcdFilterChanged';
export const ACHIEVEMENT_UNLOCKED = 'achievementUnlocked';

export type ServerEvent = 
  typeof EXPERIENCE_ADDED |
  typeof PET_AWAKE |
  typeof PET_SLEEP |
  typeof PET_LOADED |
  typeof PET_EVOLVED |
  typeof STATE_CHANGED |
  typeof EGGS_AVAILABLE |
  typeof LCD_FILTER_CHANGED |
  typeof ACHIEVEMENT_UNLOCKED;

export type ExperienceAddedMessage = {
  type: typeof EXPERIENCE_ADDED,
  data: number;
}

export type PetAwakeReason = "activity" | "typing" | "editorChanged" | "selection" | "scroll";
export type PetAwakeMessage = {
  type: typeof PET_AWAKE,
  reason?: PetAwakeReason;
}

export type PetSleepMessage = {
  type: typeof PET_SLEEP,
  idleMs?: number;
}


export type PetLoadedMessage = {
  type: typeof PET_LOADED;
  data: Pet;
}

export type PetEvolvedMessage = {
  type: typeof PET_EVOLVED;
  data: Pet;
}

export type StateChangedMessage = {
  type: typeof STATE_CHANGED;
  data: State;
}

export type EggsAvailableMessage = {
  type: typeof EGGS_AVAILABLE;
  data: Pet[];
}

export type LcdFilterMessage = {
  type: typeof LCD_FILTER_CHANGED;
  data: LCDFilter;
}

export type AchievementUnlockedMessage = {
  type: typeof ACHIEVEMENT_UNLOCKED;
  data: Achievement[];
}

export type ServerMessage = |
  TrackingMessage |
  ExperienceAddedMessage |
  PetAwakeMessage |
  PetSleepMessage |
  PetLoadedMessage |
  PetEvolvedMessage |
  StateChangedMessage |
  EggsAvailableMessage |
  LcdFilterMessage |
  AchievementUnlockedMessage;