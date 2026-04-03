
import * as vscode from 'vscode';

import { registerActiveTimeTracking } from "./active";
import { registerDiagnosticsExperienceTracking } from "./diagnostics";
import { registerNavigationExperienceTracking } from "./navigation";
import { registerGitExperienceTracking } from "./repository";
import { registerSaveExperienceTracking } from "./save";
import { registerTerminalExperienceTracking } from "./terminal";
import { RegisterTrackerFn } from "./types";
import { registerTypingExperienceTracking } from "./typing";

export const registerTrackers: RegisterTrackerFn = (args) => vscode.Disposable.from(
  registerActiveTimeTracking(args),
  registerTypingExperienceTracking(args),
  registerSaveExperienceTracking(args),
  registerTerminalExperienceTracking(args),
  registerDiagnosticsExperienceTracking(args),
  registerNavigationExperienceTracking(args),
  registerGitExperienceTracking(args),
);