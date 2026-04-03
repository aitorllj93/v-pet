import * as vscode from "vscode";
import { Pet } from "../types";
import { RegisterTrackerFn } from "./types";
import { DIAGNOSTICS_CHANGED, EXPERIENCE_ADDED } from "../types/messages";

type DiagnosticCount = {
  errors: number;
  warnings: number;
};

const UNKNOWN_LANGUAGE = 'unknown';

export const registerDiagnosticsExperienceTracking: RegisterTrackerFn = ({
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

  const diagnosticsByUri = new Map<string, DiagnosticCount>();

  for (const doc of vscode.workspace.textDocuments) {
    diagnosticsByUri.set(doc.uri.toString(), countDiagnostics(doc.uri));
  }

  function countDiagnostics(uri: vscode.Uri): DiagnosticCount {
    const diagnostics = vscode.languages.getDiagnostics(uri);

    let errors = 0;
    let warnings = 0;

    for (const diagnostic of diagnostics) {
      if (diagnostic.severity === vscode.DiagnosticSeverity.Error) {
        errors += 1;
        continue;
      }

      if (diagnostic.severity === vscode.DiagnosticSeverity.Warning) {
        warnings += 1;
      }
    }

    return { errors, warnings };
  }

  function ensureSnapshot(uri: vscode.Uri): DiagnosticCount {
    const key = uri.toString();
    const existing = diagnosticsByUri.get(key);

    if (existing) {
      return existing;
    }

    const snapshot = countDiagnostics(uri);
    diagnosticsByUri.set(key, snapshot);
    return snapshot;
  }

  const handleDiagnosticsChanged = (event: vscode.DiagnosticChangeEvent) => {
    const current = stateManager.get();

    if (current.petId === null) {
      return;
    }

    let xpToAdd = 0;
    let affectedDoc:
      | {
        uri: string;
        fileName: string;
        languageId: string;
      }
      | null = null;

    for (const uri of event.uris) {
      const before = ensureSnapshot(uri);
      const after = countDiagnostics(uri);

      const removedErrors = Math.max(0, before.errors - after.errors);
      const removedWarnings = Math.max(0, before.warnings - after.warnings);

      if (removedErrors > 0 || removedWarnings > 0) {
        xpToAdd += removedErrors * config.experience.multipliers.errorRemoved;
        xpToAdd += removedWarnings * config.experience.multipliers.warningRemoved;

        try {
          const doc = vscode.workspace.textDocuments.find(
            (textDocument) => textDocument.uri.toString() === uri.toString()
          );

          affectedDoc = {
            uri: uri.toString(),
            fileName: doc?.fileName ?? uri.fsPath,
            languageId: doc?.languageId ?? UNKNOWN_LANGUAGE,
          };
        } catch {
          affectedDoc = {
            uri: uri.toString(),
            fileName: uri.fsPath,
            languageId: UNKNOWN_LANGUAGE,
          };
        }
      }

      diagnosticsByUri.set(uri.toString(), after);
    }

    if (xpToAdd <= 0) {
      return;
    }

    stateManager.addExp(xpToAdd);

    const updated = stateManager.get();

    if (!updated.petId) {
      return;
    }

    const pet = petsManager.getPet(updated.petId) as Pet;

    if (affectedDoc) {
      provider.postMessage({
        type: DIAGNOSTICS_CHANGED,
        uri: affectedDoc.uri,
        fileName: affectedDoc.fileName,
        languageId: affectedDoc.languageId,
        data: {
          experienceAdded: xpToAdd,
        },
      });
    }

    provider.postMessage({
      type: EXPERIENCE_ADDED,
      data: updated.experience,
    });

    checkEvolution(pet, updated);
    checkAchievements(updated);
  };

  const diagnosticsChangedSub = vscode.languages.onDidChangeDiagnostics((event) => {
    try {
      handleDiagnosticsChanged(event);
    } catch (err) {
      logger.error(`[TRACKING - DIAGNOSTICS] Error handling diagnostics change: ${(err as Error).message}`);
    }
  });

  const handleTextDocumentClosed = (doc: vscode.TextDocument) => {
    diagnosticsByUri.delete(doc.uri.toString());
  };

  const closeSub = vscode.workspace.onDidCloseTextDocument((doc) => {
    try {
      handleTextDocumentClosed(doc);
    } catch (err) {
      logger.error(`[TRACKING - DIAGNOSTICS] Error handling document close: ${(err as Error).message}`);
    }
  });

  const handleTextDocumentOpen = (doc: vscode.TextDocument) => {
    setTimeout(() => {
      diagnosticsByUri.set(doc.uri.toString(), countDiagnostics(doc.uri));
    }, 300);
  };

  const openSub = vscode.workspace.onDidOpenTextDocument((doc) => {
    try {
      handleTextDocumentOpen(doc);
    } catch (err) {
      logger.error(`[TRACKING - DIAGNOSTICS] Error handling document open: ${(err as Error).message}`);
    }
  });
  
  
  const disposable = vscode.Disposable.from(
    diagnosticsChangedSub,
    closeSub,
    openSub
  );

  context.subscriptions.push(disposable);

  return disposable;
};