import * as vscode from "vscode";
import { StateManager } from "../services/state.manager";
import { PetsManager } from "../services/pets.manager";
import { WatchViewProvider } from "../views/watch";
import { Pet, State } from "../types";
import { Logger } from "../services/logger";
import { InteractionManager } from "../services/interaction.manager";
import { ConfigManager } from "../services/config.manager";

export type RegisterTrackerFn = (args: {
  context: vscode.ExtensionContext;
  configManager: ConfigManager,
  logger: Logger,
  interactionManager: InteractionManager,
  stateManager: StateManager,
  petsManager: PetsManager,
  provider: WatchViewProvider,
  checkAchievements: (current: State) => void;
  checkEvolution: (pet: Pet, current: State) => void;
}) => vscode.Disposable;