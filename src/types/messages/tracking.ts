

export const ACTIVE = 'active';
export const NAVIGATION = 'navigation';
export const NAVIGATION_COMMAND = 'navigationCommand';
export const TERMINAL_COMMAND_EXECUTED = 'terminalCommandExecuted';
export const TERMINAL_TESTS_PASSED = 'terminalTestsPassed';
export const DIAGNOSTICS_CHANGED = 'diagnosticsChanged';
export const GIT_COMMIT = 'gitCommit';
export const GIT_BRANCH_CREATED = 'gitBranchCreated';
export const GIT_MERGE = 'gitMerge';
export const FILE_CHANGED = 'fileChanged';
export const FILE_SAVED = 'fileSaved';

export type TrackingEvent = |
  typeof ACTIVE |  
  typeof NAVIGATION |
  typeof NAVIGATION_COMMAND |
  typeof TERMINAL_COMMAND_EXECUTED |
  typeof TERMINAL_TESTS_PASSED |
  typeof DIAGNOSTICS_CHANGED |
  typeof GIT_COMMIT |
  typeof GIT_BRANCH_CREATED |
  typeof GIT_MERGE |
  typeof FILE_CHANGED;

export type ActiveMessage = {
  type: typeof ACTIVE;
  data: {
    experienceAdded: number;
  };
}

export type NavigationMessage = {
  type: typeof NAVIGATION;
  uri: string;
  fileName: string;
  languageId: string;
  data: {
    experienceAdded: number;
  },
}

export type NavigationCommandMessage = {
  type: typeof NAVIGATION_COMMAND,
  command: string;
  uri: string;
  fileName: string;
  languageId: string;
}

export type TerminalCommandMessage = {
  type: typeof TERMINAL_COMMAND_EXECUTED | typeof TERMINAL_TESTS_PASSED;
  terminalName: string;
  command: string;
  languageId: string;
  data: {
    experienceAdded: number;
  },
}

export type DiagnosticsChangedMessage = {
  type: typeof DIAGNOSTICS_CHANGED;
  uri: string;
  fileName: string;
  languageId: string;
  data: {
    experienceAdded: number;
  },
}

export type GitRepositoryChangedMessage = {
  type: typeof GIT_COMMIT | typeof GIT_BRANCH_CREATED | typeof GIT_MERGE,
  uri: string;
  data: {
    experienceAdded: number;
  },
}

export type FileChangedMessage = {
  type: typeof FILE_CHANGED;
  uri: string;
  fileName: string;
  languageId: string;
  data: {
    experienceAdded: number;
  };
}

export type FileSavedMessage = {
  type: typeof FILE_SAVED;
  uri: string;
  fileName: string;
  languageId: string;
  data: {
    experienceAdded: number;
  };
}


export type TrackingMessage =
  ActiveMessage |
  NavigationMessage |
  // NavigationCommandMessage |
  TerminalCommandMessage |
  DiagnosticsChangedMessage |
  GitRepositoryChangedMessage |
  FileChangedMessage |
  FileSavedMessage;  