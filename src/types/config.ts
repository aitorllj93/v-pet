import type { PetId, PetLevel } from "./pet";

export const LCD_FILTER_NONE = 'none';
export const LCD_FILTER_LCD = 'lcd';
export const LCD_FILTER_GREEN = 'green';
export const LCD_FILTER_DARK = 'dark';

export type LCDFilter = |
  typeof LCD_FILTER_NONE | 
  typeof LCD_FILTER_LCD | 
  typeof LCD_FILTER_GREEN | 
  typeof LCD_FILTER_DARK;

export type Config = {
  lcdFilter: LCDFilter;
  excludePets: PetId[];
  randomEggs: boolean;
  discoverMode: boolean;
  experience: {
    evolutionConditions: Record<PetLevel, number>;
    multipliers: {
      active: number;
      errorRemoved: number;
      warningRemoved: number;
      cursorStep: number;
      fileChange: number;
      gitCommit: number;
      gitBranch: number;
      gitMerge: number;
      fileSave: number;
      fileSaveStreak: number;
      terminalCommand: number;
      terminalBuildOrTest: number;
      terminalTestsPassed: number;
      typing: number;
      lines: number;
      typingStreak: number;
    };
  };
}