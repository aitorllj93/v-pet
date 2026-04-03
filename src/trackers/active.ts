import * as vscode from "vscode";
import { RegisterTrackerFn } from "./types";
import { Pet } from "../types";
import { ACTIVE, EXPERIENCE_ADDED, PET_AWAKE, PET_SLEEP, PetAwakeReason } from "../types/messages";
import { ACTIVE_GRACE_MS, ACTIVE_XP_STEP_MS, IDLE_SLEEP_MS } from "./constants";

const AWAKE = 'awake';
const SLEEPING = 'sleeping';

type SleepState = |
  typeof AWAKE |
  typeof SLEEPING;

export const registerActiveTimeTracking: RegisterTrackerFn = ({
  configManager,
  context,
  stateManager,
  petsManager,
  provider,
  checkAchievements,
  checkEvolution,
}) => {
  const config = configManager.loadConfig();
  let lastActivityAt = Date.now();
  let lastTickAt = Date.now();
  let activeAccumulatedMs = 0;
  let sleepState: SleepState = AWAKE;
  let lastMarkedAt = 0;

  function markActivity(reason: PetAwakeReason) {
    const now = Date.now();

    if (now - lastMarkedAt < 500) {
      return;
    }

    lastMarkedAt = now;
    lastActivityAt = now;

    if (sleepState === SLEEPING) {
      sleepState = AWAKE;

      provider.postMessage({
        type: PET_AWAKE,
        reason,
      });
    }
  }

  function tick() {
    const now = Date.now();
    const current = stateManager.ensurePetForToday();

    if (current.petId === null) {
      lastTickAt = now;
      return;
    }

    const pet = petsManager.getPet(current.petId) as Pet;
    const delta = now - lastTickAt;
    lastTickAt = now;

    const idleFor = now - lastActivityAt;
    const isActive = idleFor <= ACTIVE_GRACE_MS;

    if (isActive) {
      activeAccumulatedMs += delta;

      if (sleepState === SLEEPING) {
        sleepState = AWAKE;
        provider.postMessage({
          type: PET_AWAKE,
          reason: "activity",
        });
      }

      let xpToAdd = 0;

      while (activeAccumulatedMs >= ACTIVE_XP_STEP_MS) {
        activeAccumulatedMs -= ACTIVE_XP_STEP_MS;
        xpToAdd += config.experience.multipliers.active;
      }

      if (xpToAdd > 0) {
        stateManager.addExp(xpToAdd);

        const updated = stateManager.get();

        provider.postMessage({
          type: ACTIVE,
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
      }

      return;
    }

    if (idleFor >= IDLE_SLEEP_MS && sleepState !== SLEEPING) {
      sleepState = SLEEPING;

      provider.postMessage({
        type: PET_SLEEP,
        idleMs: idleFor,
      });
    }
  }

  const interval = setInterval(tick, 5_000);

  context.subscriptions.push({
    dispose: () => clearInterval(interval),
  });

  const textChangedSub = vscode.workspace.onDidChangeTextDocument(() => {
    markActivity("typing");
  });

  const activeEditorChangedSub = vscode.window.onDidChangeActiveTextEditor(() => {
    markActivity("editorChanged");
  });

  const selectionChangedSub = vscode.window.onDidChangeTextEditorSelection(() => {
    markActivity("selection");
  });

  const visibleRangesChangedSub = vscode.window.onDidChangeTextEditorVisibleRanges(() => {
    markActivity("scroll");
  });

  const disposable = vscode.Disposable.from(
    textChangedSub,
    activeEditorChangedSub,
    selectionChangedSub,
    visibleRangesChangedSub,
    { dispose: () => clearInterval(interval) }
  );

  context.subscriptions.push(disposable);

  return disposable;
};