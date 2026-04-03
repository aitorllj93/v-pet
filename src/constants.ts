import { ADULT, BABY_1, BABY_2, CHILD, EGG, PERFECT, PetLevel, ULTIMATE, ULTIMATE_PLUS } from "./types";


export const NAMESPACE = 'd-code';

export const CONFIG_LCD_FILTER = 'lcdFilter';
export const CONFIG_EXCLUDE_PETS = 'excludePets';
export const CONFIG_RANDOM_EGGS = 'randomEggs';
export const CONFIG_DISCOVER_MODE = 'discoverMode';

export const CONFIG_EXPERIENCE_EVOLUTION_BABY_1 = 'experience.evolutionConditions.baby1';
export const CONFIG_EXPERIENCE_EVOLUTION_BABY_2 = 'experience.evolutionConditions.baby2';
export const CONFIG_EXPERIENCE_EVOLUTION_CHILD = 'experience.evolutionConditions.child';
export const CONFIG_EXPERIENCE_EVOLUTION_ADULT = 'experience.evolutionConditions.adult';
export const CONFIG_EXPERIENCE_EVOLUTION_PERFECT = 'experience.evolutionConditions.perfect';
export const CONFIG_EXPERIENCE_EVOLUTION_ULTIMATE = 'experience.evolutionConditions.ultimate';
export const CONFIG_EXPERIENCE_EVOLUTION_ULTIMATE_PLUS = 'experience.evolutionConditions.ultimate_plus';

export const CONFIG_EXPERIENCE_MULTIPLIERS_ACTIVE = 'experience.multipliers.active';
export const CONFIG_EXPERIENCE_MULTIPLIERS_ERROR_REMOVED = 'experience.multipliers.errorRemoved';
export const CONFIG_EXPERIENCE_MULTIPLIERS_WARNING_REMOVED = 'experience.multipliers.warningRemoved';
export const CONFIG_EXPERIENCE_MULTIPLIERS_CURSOR_STEP = 'experience.multipliers.cursorStep';
export const CONFIG_EXPERIENCE_MULTIPLIERS_FILE_CHANGE = 'experience.multipliers.fileChange';
export const CONFIG_EXPERIENCE_MULTIPLIERS_GIT_COMMIT = 'experience.multipliers.gitCommit';
export const CONFIG_EXPERIENCE_MULTIPLIERS_GIT_BRANCH = 'experience.multipliers.gitBranch';
export const CONFIG_EXPERIENCE_MULTIPLIERS_GIT_MERGE = 'experience.multipliers.gitMerge';
export const CONFIG_EXPERIENCE_MULTIPLIERS_FILE_SAVE = 'experience.multipliers.fileSave';
export const CONFIG_EXPERIENCE_MULTIPLIERS_FILE_SAVE_STREAK = 'experience.multipliers.fileSaveStreak';
export const CONFIG_EXPERIENCE_MULTIPLIERS_TERMINAL_COMMAND = 'experience.multipliers.terminalCommand';
export const CONFIG_EXPERIENCE_MULTIPLIERS_TERMINAL_BUILD_OR_TEST = 'experience.multipliers.terminalBuildOrTest';
export const CONFIG_EXPERIENCE_MULTIPLIERS_TERMINAL_TESTS_PASSED = 'experience.multipliers.terminalTestsPassed';
export const CONFIG_EXPERIENCE_MULTIPLIERS_TYPING = 'experience.multipliers.typing';
export const CONFIG_EXPERIENCE_MULTIPLIERS_LINES = 'experience.multipliers.lines';
export const CONFIG_EXPERIENCE_MULTIPLIERS_TYPING_STREAK = 'experience.multipliers.typingStreak';

export const LOG_FILENAME = `${NAMESPACE}.log`;
export const LOG_MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1 MB
export const LOG_MAX_FILES = 5;
export const LOG_FLUSH_INTERVAL_MS = 100;

export const STATE_KEY = `${NAMESPACE}.pet`;

export const COMMAND_OPEN_TREE = `${NAMESPACE}.openTree`;
export const COMMAND_OPEN_ENCYCLOPEDIA = `${NAMESPACE}.openEncyclopedia`;
export const COMMAND_CHOOSE_EGG = `${NAMESPACE}.chooseEgg`;
export const COMMAND_RESET_PROGRESS = `${NAMESPACE}.resetProgress`;

export const VIEW_WATCH = `${NAMESPACE}.watchView`;

export const PANEL_TREE = `${NAMESPACE}.evolutionTreePanel`;
export const PANEL_ENCYCLOPEDIA = `${NAMESPACE}.encyclopediaPanel`;

export const EVOLUTION_EXP_CONDITION_BY_LEVEL: Record<PetLevel, number> = {
  [EGG]: 0,
  [BABY_1]: 100,
  [BABY_2]: 200,
  [CHILD]: 250,
  [ADULT]: 400,
  [PERFECT]: 700,
  [ULTIMATE]: 1000,
  [ULTIMATE_PLUS]: 1200,
};