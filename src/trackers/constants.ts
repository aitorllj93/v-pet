
// Active

export const ACTIVE_XP_STEP_MS = 60_000;
export const ACTIVE_XP_AMOUNT = 2;
export const IDLE_SLEEP_MS = 3 * 60_000;
export const ACTIVE_GRACE_MS = 15_000; // ventana en la que seguimos considerando "activo"

// Diagnostics

export const XP_PER_ERROR_REMOVED = 15;
export const XP_PER_WARNING_REMOVED = 5;

// Navigation

export const CURSOR_STEP = 30;
export const XP_PER_CURSOR_STEP = 1;
export const XP_PER_FILE_CHANGE = 2;
/** No API available for this */
export const COMMAND_XP: Record<string, number> = {
  "editor.action.revealDefinition": 3,
  "editor.action.peekDefinition": 2,
  "editor.action.goToReferences": 3,
  "editor.action.goToImplementation": 3,
  "editor.action.goToTypeDefinition": 3,
  "workbench.action.quickOpen": 2,
  "workbench.action.quickFix": 10,
  "workbench.action.refactor": 20,
  "workbench.action.gotoSymbol": 2,
  "workbench.action.showAllSymbols": 3,
};

// Repository

export const COMMIT_XP = 50;
export const NEW_BRANCH_XP = 30;
export const MERGE_XP = 80;

// File Save

export const SAVE_XP = 3;
export const SAVE_STREAK_GAP_MS = 5 * 60 * 1000;
export const SAVE_STREAK_BONUS_XP = 10;

// Terminal

export const XP_PER_COMMAND = 5;
export const XP_BUILD_TEST = 20;
export const TESTS_PASSED_XP = 40;

export const WATCH_COOLDOWN = 60_000;

// Typing

export const CHARS_STEP = 20;
export const XP_PER_CHARS_STEP = 1;

export const LINES_STEP = 10;
export const XP_PER_LINES_STEP = 5;

export const STREAK_MS = 5 * 60 * 1000;
export const STREAK_BONUS_XP = 20;
export const PAUSE_THRESHOLD_MS = 30_000;