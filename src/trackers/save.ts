import * as vscode from "vscode";
import { EXPERIENCE_ADDED, FILE_SAVED, Pet } from "../types";
import { RegisterTrackerFn } from "./types";
import { SAVE_STREAK_GAP_MS } from "./constants";

export const registerSaveExperienceTracking: RegisterTrackerFn = ({
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
  let lastSavedAt: number | null = null;

  const handleDocumentSaved = (doc: vscode.TextDocument) => {
    const current = stateManager.get();

    if (current.petId === null) {
      return;
    }
    
    const isTouchedByUser = interactionManager.isTouchedByUser(doc);

    if (!isTouchedByUser) {
      return;
    }

    let xpToAdd = config.experience.multipliers.fileSave;
    const now = Date.now();

    if (lastSavedAt !== null && now - lastSavedAt > SAVE_STREAK_GAP_MS) {
      xpToAdd += config.experience.multipliers.fileSaveStreak;
    }

    lastSavedAt = now;

    stateManager.addExp(xpToAdd);

    const pet = petsManager.getPet(current.petId) as Pet;

    provider.postMessage({
      type: FILE_SAVED,
      uri: doc.uri.toString(),
      fileName: doc.fileName,
      languageId: doc.languageId,
      data: {
        experienceAdded: xpToAdd,
      }
    });

    const updated = stateManager.get();

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  };

  const textDocumentSavedSub = vscode.workspace.onDidSaveTextDocument((doc) => {
    try {
      handleDocumentSaved(doc);
    } catch (err) {
      logger.error(`[TRACKING - SAVE] Error handling doc save: ${(err as Error).message}`);
    }
  });

  const disposable = vscode.Disposable.from(textDocumentSavedSub);

  context.subscriptions.push(disposable);

  return disposable;
};