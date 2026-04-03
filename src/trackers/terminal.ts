import * as vscode from "vscode";
import { RegisterTrackerFn } from "./types";
import { EXPERIENCE_ADDED, Pet, TERMINAL_COMMAND_EXECUTED, TERMINAL_TESTS_PASSED } from "../types";
import { WATCH_COOLDOWN } from "./constants";

const SHELL_LANGUAGE = 'shell';

type TrackedExecution = {
  command: string;
  terminalName: string;
};

function isKnownTestCommand(command: string): boolean {
  const normalized = command.trim().toLowerCase();

  const patterns: RegExp[] = [
    /^npm\s+(run\s+)?test(\s|$)/,
    /^pnpm\s+(run\s+)?test(\s|$)/,
    /^yarn\s+test(\s|$)/,
    /^bun\s+test(\s|$)/,
    /^cargo\s+test(\s|$)/,
    /^pytest(\s|$)/,
    /^python(\d+(\.\d+)*)?\s+-m\s+pytest(\s|$)/,
    /^go\s+test(\s|$)/,
    /^dotnet\s+test(\s|$)/,
    /^jest(\s|$)/,
    /^vitest(\s|$)/,
    /^npx\s+(jest|vitest)(\s|$)/,
    /^mvn\s+test(\s|$)/,
    /^gradle(w)?\s+test(\s|$)/,
  ];

  return patterns.some((pattern) => pattern.test(normalized));
}

export const registerTerminalExperienceTracking: RegisterTrackerFn = ({
  configManager,
  context,
  logger,
  stateManager,
  petsManager,
  provider,
  checkAchievements,
  checkEvolution,
}) => {
  const config = configManager.loadConfig();
  const lastTestRun = new Map<vscode.Terminal, number>();
  const trackedExecutions = new WeakMap<vscode.TerminalShellExecution, TrackedExecution>();

  const handleTerminalShellExecutionStart = (event: vscode.TerminalShellExecutionStartEvent) => {
    const current = stateManager.get();
    if (current.petId === null) {
      return;
    }

    const command = event.execution.commandLine.value;
    let xpToAdd = config.experience.multipliers.terminalCommand;

    if (/\b(build|test)\b/i.test(command) || isKnownTestCommand(command)) {
      xpToAdd += config.experience.multipliers.terminalBuildOrTest;
    }

    if (isKnownTestCommand(command)) {
      const now = Date.now();
      const last = lastTestRun.get(event.terminal) ?? 0;

      if (now - last < WATCH_COOLDOWN) {
        return;
      }

      lastTestRun.set(event.terminal, now);
      trackedExecutions.set(event.execution, {
        command,
        terminalName: event.terminal.name,
      });
    }

    stateManager.addExp(xpToAdd);

    const pet = petsManager.getPet(current.petId) as Pet;
    const updated = stateManager.get();

    provider.postMessage({
      type: TERMINAL_COMMAND_EXECUTED,
      terminalName: event.terminal.name,
      command,
      languageId: SHELL_LANGUAGE,
      data: {

        experienceAdded: xpToAdd,
      }
    });

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  };

  const terminalExecutionStartSub = vscode.window.onDidStartTerminalShellExecution((event) => {
    try {
      handleTerminalShellExecutionStart(event);
    } catch (err) {
      logger.error(`[TRACKING - TERMINAL] Error handling terminal shell execution start: ${(err as Error).message}`);
    }
  });

  const handleTerminalShellExecutionEnd = (event: vscode.TerminalShellExecutionEndEvent) => {
    const tracked = trackedExecutions.get(event.execution);

    if (!tracked) {
      return;
    }

    if (event.exitCode !== 0) {
      return;
    }

    const current = stateManager.get();
    if (current.petId === null) {
      return;
    }

    stateManager.addExp(config.experience.multipliers.terminalTestsPassed);

    const pet = petsManager.getPet(current.petId) as Pet;
    const updated = stateManager.get();

    provider.postMessage({
      type: TERMINAL_TESTS_PASSED,
      terminalName: tracked.terminalName,
      command: tracked.command,
      languageId: SHELL_LANGUAGE,
      data: {
        experienceAdded: config.experience.multipliers.terminalTestsPassed,
      }
    });

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
  };
  

  const terminalExecutionEndSub = vscode.window.onDidEndTerminalShellExecution((event) => {
    try {
      handleTerminalShellExecutionEnd(event);
    } catch (err) {
      logger.error(`[TRACKING - TERMINAL] Error handling terminal shell execution end: ${(err as Error).message}`);
    }
  });

  const disposable = vscode.Disposable.from(terminalExecutionStartSub, terminalExecutionEndSub);

  context.subscriptions.push(disposable);

  return disposable;
};