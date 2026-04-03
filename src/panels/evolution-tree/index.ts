import * as vscode from "vscode";

import type { PetsManager } from "../../services/pets.manager";
import type { StateManager } from "../../services/state.manager";
import { type ClientMessage, type PetId } from "../../types";
import { PANEL_TREE } from "../../constants";
import { AchievementsManager } from "../../services/achievements.manager";
import { useTranslation } from "../../i18n/use-translation";
import { RunTimePackageManager } from "../../services/rtp.manager";

const { t: tCommon } = useTranslation('common');
const { t } = useTranslation('evolutionTree');

export class EvolutionTreePanel {
  public static readonly viewType = PANEL_TREE;

  public static listeners: ((e: ClientMessage) => any)[] = [];
  private static currentPanel: EvolutionTreePanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly disposables: vscode.Disposable[] = [];

  public static createOrShow(
    ctx: vscode.ExtensionContext,
    rtp: RunTimePackageManager,
    state: StateManager,
    pets: PetsManager,
    achievements: AchievementsManager,
  ) {
    const column = vscode.window.activeTextEditor?.viewColumn;

    if (EvolutionTreePanel.currentPanel) {
      EvolutionTreePanel.currentPanel.panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      EvolutionTreePanel.viewType,
      t('title'),
      column ?? vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(ctx.extensionUri, "media")],
      }
    );

    EvolutionTreePanel.currentPanel = new EvolutionTreePanel(panel, ctx, rtp, state, pets, achievements);
  }

  public static addListener(listener: (e: ClientMessage) => any) {
    EvolutionTreePanel.listeners.push(listener);
  }

  public static refresh() {
    if (!EvolutionTreePanel.currentPanel) {
      return;
    }

    EvolutionTreePanel.currentPanel.render();
  }

  private constructor(
    panel: vscode.WebviewPanel,
    ctx: vscode.ExtensionContext,
    private readonly rtp: RunTimePackageManager,
    private readonly state: StateManager,
    private readonly pets: PetsManager,
    private readonly achievements: AchievementsManager,
  ) {
    this.panel = panel;
    this.extensionUri = ctx.extensionUri;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    this.panel.webview.onDidReceiveMessage(async (message: ClientMessage) => {
      for (const listener of EvolutionTreePanel.listeners) {
        listener(message);
      }
    });

    this.panel.webview.html = this.getHtml(this.panel.webview);

    this.panel.iconPath = this.rtp.getPanelIconPath();
  }

  public render() {
    this.panel.webview.html = this.getHtml(this.panel.webview);
  }

  public dispose() {
    EvolutionTreePanel.currentPanel = undefined;

    while (this.disposables.length) {
      const item = this.disposables.pop();
      try {
        item?.dispose();
      } catch {
        // noop
      }
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, "media");

    const italicFontUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "fonts", "Pixel Digivolve Italic.otf")
    );

    const pets = this.pets.getPets();
    const achievements = this.achievements.getAchievements();
    const state = this.state.get();

    const spriteBaseUri = this.rtp.getSpritesBaseUri(webview);

    const spriteMap: Record<PetId, string> = {};
    for (const pet of pets) {
      spriteMap[pet.id] = this.rtp.getSpriteUri(spriteBaseUri, pet.id);
      for (const variation of (pet.variations ?? [])) {
        spriteMap[variation.id] = this.rtp.getSpriteUri(spriteBaseUri, variation.id);
      }
    }
    const totalPets = Object.keys(spriteMap).length;

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "css", "evolution-tree.css")
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(mediaUri, "js", "evolution-tree.js")
    );

    const csp = [
      `default-src 'none'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource}`
    ].join("; ");

    return /* html */ `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${t('title')}</title>
  <link rel="stylesheet" nonce="${nonce}" href="${styleUri}">
  <style nonce="${nonce}">
    @font-face {
      font-family: "Pixel Digivolve Italic";
      src: url("${italicFontUri}") format("opentype");
      font-weight: 500;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="root">
    <div class="toolbar">
      <div class="controls">
        <input id="search" class="search-input" type="text" placeholder="${tCommon('search')}">
        <button id="zoom-out" class="zoom-btn">-</button>
        <button id="zoom-in" class="zoom-btn">+</button>
      </div>
      <div class="counter">
        ${state.seenPets.length}/${totalPets}
      </div>
    </div>
    <div class="scroller">
      <div id="board" class="board"></div>
    </div>
  </div>

  <script nonce="${nonce}">
    window.DATA = ${JSON.stringify(pets)};
    window.ACTIVE = ${JSON.stringify(state.petId)};
    window.SEEN = ${JSON.stringify(state.seenPets)};
    window.ACHIEVEMENTS = ${JSON.stringify(achievements)};
    window.ACHIEVED = ${JSON.stringify(state.achievements)};
    window.SPRITES = ${JSON.stringify(spriteMap)};
  </script>

  <script nonce="${nonce}" src="${scriptUri}"></script>  
</body>
</html>
    `;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}