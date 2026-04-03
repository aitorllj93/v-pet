import * as vscode from "vscode";
import { EXPERIENCE_ADDED, FILE_CHANGED, Pet } from "../types";
import { RegisterTrackerFn } from "./types";
import { CHARS_STEP, LINES_STEP, PAUSE_THRESHOLD_MS, STREAK_MS } from "./constants";

type TypingProgress = {
  charRemainder: number;
  lineRemainder: number;
};

type TypingStreak = {
  startedAt: number | null;
  lastTypingAt: number | null;
  bonusGranted: boolean;
};

export const registerTypingExperienceTracking: RegisterTrackerFn = ({
  configManager,
  context,
  logger,
  interactionManager,
  stateManager,
  petsManager,
  provider,
  checkAchievements,
  checkEvolution,
}) => {
  const config = configManager.loadConfig();
  const progressByDocument = new Map<string, TypingProgress>();

  const streak: TypingStreak = {
    startedAt: null,
    lastTypingAt: null,
    bonusGranted: false,
  };

  function getProgress(uri: string): TypingProgress {
    let progress = progressByDocument.get(uri);

    if (!progress) {
      progress = {
        charRemainder: 0,
        lineRemainder: 0,
      };
      progressByDocument.set(uri, progress);
    }

    return progress;
  }

  function getInsertedChars(change: vscode.TextDocumentContentChangeEvent): number {
    return Math.max(0, change.text.length - change.rangeLength);
  }

  function getInsertedLines(change: vscode.TextDocumentContentChangeEvent): number {
    return (change.text.match(/\n/g) ?? []).length;
  }

  function applyStreakBonus(now: number): number {
    const hadPause =
      streak.lastTypingAt !== null &&
      now - streak.lastTypingAt > PAUSE_THRESHOLD_MS;

    if (streak.startedAt === null || hadPause) {
      streak.startedAt = now;
      streak.bonusGranted = false;
    }

    streak.lastTypingAt = now;

    if (
      streak.startedAt !== null &&
      !streak.bonusGranted &&
      now - streak.startedAt >= STREAK_MS
    ) {
      streak.bonusGranted = true;
      return config.experience.multipliers.typingStreak;
    }

    return 0;
  }

  const handleTextDocumentChange = (doc: vscode.TextDocument, contentChanges: vscode.TextDocumentContentChangeEvent[]) => {
    const current = stateManager.get();

    if (current.petId === null) {
      return;
    }

    if (contentChanges.length === 0) {return;}

    const isTouchedByUser = interactionManager.isTouchedByUser(doc);

    if (!isTouchedByUser) {
      return;
    }

    const pet = petsManager.getPet(current.petId) as Pet;
    const progress = getProgress(doc.uri.toString());

    let xpToAdd = 0;
    let hasTyping = false;

    for (const change of contentChanges) {
      const insertedChars = getInsertedChars(change);
      const insertedLines = getInsertedLines(change);

      if (insertedChars > 0 || insertedLines > 0) {
        hasTyping = true;
      }

      progress.charRemainder += insertedChars;
      if (progress.charRemainder >= CHARS_STEP) {
        const steps = Math.floor(progress.charRemainder / CHARS_STEP);
        xpToAdd += steps * config.experience.multipliers.typing;
        progress.charRemainder %= CHARS_STEP;
      }

      progress.lineRemainder += insertedLines;
      if (progress.lineRemainder >= LINES_STEP) {
        const steps = Math.floor(progress.lineRemainder / LINES_STEP);
        xpToAdd += steps * config.experience.multipliers.lines;
        progress.lineRemainder %= LINES_STEP;
      }
    }

    if (hasTyping) {
      xpToAdd += applyStreakBonus(Date.now());
    }

    if (xpToAdd > 0) {
      stateManager.addExp(xpToAdd);
    }

    provider.postMessage({
      type: FILE_CHANGED,
      uri: doc.uri.toString(),
      fileName: doc.fileName,
      languageId: doc.languageId,
      data: {
        experienceAdded: xpToAdd
      },
    });

    const updated = stateManager.get();

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  };

  const textDocumentChangedSub = vscode.workspace.onDidChangeTextDocument(({ document: doc, contentChanges }) => {
    try {
      handleTextDocumentChange(doc, contentChanges as vscode.TextDocumentContentChangeEvent[]);
    } catch (err) {
      logger.error(`[TRACKING - TYPING] Error handling doc change: ${(err as Error).message}`);
    }
  });


  const disposable = vscode.Disposable.from(
    textDocumentChangedSub
  );

  context.subscriptions.push(disposable);

  return disposable;
};