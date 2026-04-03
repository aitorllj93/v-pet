import * as vscode from "vscode";
import { RegisterTrackerFn } from "./types";
import { Pet } from "../types";
import { CURSOR_STEP } from "./constants";
import { EXPERIENCE_ADDED, NAVIGATION } from "../types/messages";

export const registerNavigationExperienceTracking: RegisterTrackerFn = ({
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
  let cursorChanges = 0;

  function awardXp(xp: number, doc?: vscode.TextDocument) {
    const current = stateManager.get();
    if (current.petId === null) {
      return;
    }

    stateManager.addExp(xp);

    const updated = stateManager.get();

    if (!updated.petId) {
      return;
    }

    const pet = petsManager.getPet(updated.petId) as Pet;

    if (doc) {
      provider.postMessage({
        type: NAVIGATION,
        uri: doc.uri.toString(),
        fileName: doc.fileName,
        languageId: doc.languageId,
        data: {
          experienceAdded: xp
        }
      });
    }

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  }

  const handleTextEditorSelection = (event: vscode.TextEditorSelectionChangeEvent) => {
    if (event.selections.length === 0) {
      return;
    }

    if (
      event.kind !== vscode.TextEditorSelectionChangeKind.Keyboard &&
      event.kind !== vscode.TextEditorSelectionChangeKind.Mouse
    ) {
      return;
    }

    cursorChanges++;

    if (cursorChanges >= CURSOR_STEP) {
      const steps = Math.floor(cursorChanges / CURSOR_STEP);
      cursorChanges %= CURSOR_STEP;

      awardXp(steps * config.experience.multipliers.cursorStep, event.textEditor.document);
    }
  };

  const handleActiveTextEditorChange = (editor: vscode.TextEditor | undefined) => {
    if (!editor) {
      return;
    }

    awardXp(config.experience.multipliers.fileChange, editor.document);
  };

  // Cursor movement
  const selectionSub = vscode.window.onDidChangeTextEditorSelection((event) => {
    try {
      handleTextEditorSelection(event);
    } catch (err) {
      logger.error(`[TRACKING - NAVIGATION] Error handling text editor selection: ${(err as Error).message}`);
    }
  });

  // File switch
  const editorChangeSub = vscode.window.onDidChangeActiveTextEditor((editor) => {
    try {
      handleActiveTextEditorChange(editor);
    } catch (err) {
      logger.error(`[TRACKING - NAVIGATION] Error handling text editor change: ${(err as Error).message}`);
    }
  });


  // const navigationCommandSub = (vscode.commands as any).onDidExecuteCommand((event: any) => {
  //   const xp = COMMAND_XP[event.command];

  //   if (!xp) return;

  //   const editor = vscode.window.activeTextEditor;
  //   if (!editor) return;

  //   const current = stateManager.ensurePetForToday();
  //   if (current.petId === null) return;

  //   stateManager.addExp(xp);

  //   const updated = stateManager.ensurePetForToday();
  //   const pet = petsManager.getPet(updated.petId) as Pet;

  //   provider.postMessage({
  //     type: "navigationCommand",
  //     command: event.command,
  //     uri: editor.document.uri.toString(),
  //     fileName: editor.document.fileName,
  //     languageId: editor.document.languageId,
  //   });

  //   provider.postMessage({
  //     type: "experienceAdded",
  //     data: updated.experience,
  //   });

  //   checkEvolution(pet, updated);
  // });

  const disposable = vscode.Disposable.from(
    selectionSub,
    editorChangeSub,
    // navigationCommandSub
  );

  context.subscriptions.push(disposable);

  return disposable;
};