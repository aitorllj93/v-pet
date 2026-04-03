import * as vscode from 'vscode';

import { EvolutionTreePanel } from './panels/evolution-tree';
import { EncyclopediaPanel } from './panels/encyclopedia';
import { PetsManager } from './services/pets.manager';
import { StateManager } from './services/state.manager';
import { ACHIEVEMENT_UNLOCKED, EGGS_AVAILABLE, LCD_FILTER_CHANGED, OPEN_ENCYCLOPEDIA_ENTRY, PET_EVOLVED, PET_LOADED, STATE_CHANGED, type Pet, type State } from './types';
import { WatchViewProvider } from './views/watch';
import { registerTrackers } from './trackers';
import { ConfigManager } from './services/config.manager';
import { Logger } from './services/logger';
import { NAMESPACE, COMMAND_OPEN_TREE, COMMAND_OPEN_ENCYCLOPEDIA, COMMAND_CHOOSE_EGG, COMMAND_RESET_PROGRESS, } from './constants';
import { AchievementsManager } from './services/achievements.manager';
import { InteractionManager } from './services/interaction.manager';
import { RunTimePackageManager } from './services/rtp.manager';
import { useTranslation } from './i18n/use-translation';

const { t: tStatusBar } = useTranslation('statusBar');

async function pickEgg(
  configManager: ConfigManager,
  stateManager: StateManager,
  petsManager: PetsManager,
  provider: WatchViewProvider,
): Promise<void> {
  const config = configManager.getConfig();
  const eggs = petsManager.getEggs();

  if (eggs.length === 0) {
    vscode.window.showErrorMessage('V-PET: No eggs available to choose from.');
    return;
  }

  const items = eggs.map(pet => ({
    label: pet.name,
    description: `#${pet.id}`,
    pet,
  }));

  const picked = config.randomEggs ?
    items[Math.floor(Math.random() * items.length)] :
    await vscode.window.showQuickPick(items, {
      placeHolder: 'Choose an egg to start your day',
    });

  if (!picked) {
    return;
  }

  stateManager.setPet(picked.pet.id, picked.pet.level);
  const state = stateManager.get();

  provider.postMessage({
    type: STATE_CHANGED,
    data: state,
  });

  provider.postMessage({
    type: PET_LOADED,
    data: picked.pet,
  });
}

function ensurePetSelectedForToday(
  stateManager: StateManager,
): void {
  stateManager.ensurePetForToday();
}

let logger: Logger;

const initialize = (
  context: vscode.ExtensionContext,
  configManager: ConfigManager,
  rtpManager: RunTimePackageManager,
  stateManager: StateManager,
  petsManager: PetsManager,
  achievementsManager: AchievementsManager,
) => {

  stateManager.loadState();

  const provider = new WatchViewProvider(context, logger, configManager, stateManager, petsManager);

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN_TREE, () => {
      EvolutionTreePanel.createOrShow(context, rtpManager, stateManager, petsManager, achievementsManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_OPEN_ENCYCLOPEDIA, () => {
      EncyclopediaPanel.createOrShow(context, rtpManager, stateManager, petsManager, achievementsManager);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_CHOOSE_EGG, async () => {
      await pickEgg(configManager, stateManager, petsManager, provider);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_RESET_PROGRESS, async () => {
      const answer = await vscode.window.showInformationMessage(
        "You will lose all your progress, including the seen pets from the encyclopedia. ¿Are you sure?",
        "Yes",
        "No"
      );

      if (answer === "Yes") {
        stateManager.resetState();

        const eggs = petsManager.getEggs();
        provider.postMessage({
          type: EGGS_AVAILABLE,
          data: eggs,
        });
        // await pickEgg(configManager, stateManager, petsManager, provider);
        EncyclopediaPanel.refresh();
        EvolutionTreePanel.refresh();
      }
    })
  );


  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WatchViewProvider.viewId,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    )
  );

  EvolutionTreePanel.addListener((e) => {
    if (e.type === OPEN_ENCYCLOPEDIA_ENTRY) {
      EncyclopediaPanel.selectEntry(
        e.petId,
        context,
        rtpManager,
        stateManager,
        petsManager,
        achievementsManager
      );
    }
  });

  const checkEvolution = (pet: Pet | undefined, state: State) => {
    if (!pet) {
      return;
    }

    const achievementsMap = achievementsManager.getAchievementsMap();

    if (!achievementsMap) {
      return;
    }

    const nextPet = petsManager.evolve(pet, state, achievementsMap);

    if (!nextPet) {
      return;
    }

    stateManager.setPet(nextPet.id, nextPet.level);

    provider.postMessage({
      type: PET_EVOLVED,
      data: nextPet,
    });

    vscode.window.setStatusBarMessage(
      pet.level === 0 ? 
        tStatusBar('digivolve.egg', { petName: pet.name, evolutionName: nextPet.name }) :
        tStatusBar('digivolve.pet', { petName: pet.name, evolutionName: nextPet.name }),
      3000
    );

  };

  const checkAchievements = () => {
    const achieved = achievementsManager.hasAchieved(stateManager.get());

    if (achieved.length === 0) {
      return;
    }

    stateManager.addAchievements(achieved);

    provider.postMessage({
      type: ACHIEVEMENT_UNLOCKED,
      data: achieved,
    });

    const achievementForMessage = achieved[0];

    vscode.window.setStatusBarMessage(
      tStatusBar('achievement', { achievementName: achievementForMessage.name }),
      3000
    );
  };

  const interactionManager = new InteractionManager(context);

  registerTrackers({
    configManager,
    context,
    logger,
    interactionManager,
    stateManager,
    petsManager,
    provider,
    checkAchievements,
    checkEvolution,
  });


  vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration(NAMESPACE)) {
      const oldConfig = configManager.getConfig();
      const newConfig = configManager.loadConfig();

      if (JSON.stringify(oldConfig) === JSON.stringify(newConfig)) {
        return;
      }

      configManager.setConfig(newConfig);

      if (newConfig.lcdFilter !== oldConfig.lcdFilter) {
        provider.postMessage({
          type: LCD_FILTER_CHANGED,
          data: newConfig.lcdFilter,
        });
      }

      if (JSON.stringify(newConfig.excludePets) !== JSON.stringify(oldConfig.excludePets)) {
        EncyclopediaPanel.refresh();
        EvolutionTreePanel.refresh();
      }
    }
  });

      
  ensurePetSelectedForToday(stateManager);
};


export function activate(context: vscode.ExtensionContext) {
  logger = new Logger(context);

  logger.info("Extension started");

  context.subscriptions.push(logger);

  const configManager = new ConfigManager();
  const rtpManager = new RunTimePackageManager(
    vscode.Uri.joinPath(
      context.extensionUri,
      "media",
      "rtp"
    )
  );

  const petsManager = new PetsManager(configManager);
  const achievementsManager = new AchievementsManager();
  const stateManager = new StateManager(configManager, petsManager, context);

  void rtpManager.load()
    .then(({ achievements, pets }) => {
      petsManager.setPets(pets);
      achievementsManager.setAchievements(achievements);

      initialize(
        context,
        configManager,
        rtpManager,
        stateManager,
        petsManager,
        achievementsManager
      );
    });
}

export function deactivate() { }