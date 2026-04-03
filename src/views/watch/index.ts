
import {
  Uri,
  type ExtensionContext,
  type WebviewView,
  type WebviewViewProvider,
} from 'vscode';

import { ConfigManager } from '../../services/config.manager';
import { Logger } from '../../services/logger';
import type { PetsManager } from '../../services/pets.manager';
import type { StateManager } from '../../services/state.manager';

import { VIEW_WATCH } from '../../constants';
import { EGG_SELECTED, EGGS_AVAILABLE, PET_LOADED, READY, STATE_CHANGED, type ClientMessage, type PetId, type ServerMessage } from '../../types';

export class WatchViewProvider implements WebviewViewProvider {

  static readonly viewId = VIEW_WATCH;

  private view: WebviewView | undefined;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly logger: Logger,
    private readonly config: ConfigManager,
    private readonly state: StateManager,
    private readonly pets: PetsManager,
  ) { }

  resolveWebviewView(view: WebviewView) {
    this.view = view;
    const { webview } = this.view;
    const mediaUri = Uri.joinPath(this.ctx.extensionUri, "media");

    webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaUri],
    };

    const spriteUriTpl = webview.asWebviewUri(
      Uri.joinPath(mediaUri, "rtp", "sprites", `__id__.PNG`)
    );

    const scriptUri = webview.asWebviewUri(
      Uri.joinPath(mediaUri, "js", "watch.js")
    );

    const styleUri = webview.asWebviewUri(
      Uri.joinPath(mediaUri, "css", "watch.css")
    );

    const italicFontUri = webview.asWebviewUri(
      Uri.joinPath(mediaUri, "fonts", "Pixel Digivolve Italic.otf")
    );

    const bgUri = webview.asWebviewUri(
      Uri.joinPath(this.ctx.extensionUri, "media", "rtp", "background.png")
    );

    const nonce = String(Date.now());

    const config = this.config.getConfig();

    webview.onDidReceiveMessage(async (message: ClientMessage) => {
      if (message.type === READY) {
        this.onViewReady();
      }
      if (message.type === EGG_SELECTED) {
        this.onEggSelected(message.petId);
      }
    });

    const csp = [
      `default-src 'none'`,
      `font-src ${webview.cspSource}`,
      `img-src ${webview.cspSource}`,
      `style-src ${webview.cspSource} 'nonce-${nonce}'`,
      `script-src ${webview.cspSource} 'nonce-${nonce}'`,
      `connect-src ${webview.cspSource}`
    ].join("; ");

    view.webview.html = `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Security-Policy" content="${csp}" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
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
        <div id="watch" class="filter-${config.lcdFilter}">
          <div id="watch-pet-view" class="watch-pet-view">
          </div>
          <div id="watch-carousel" class="watch-carousel">
            <button type="button" class="watch-carousel-arrow watch-carousel-arrow-left" aria-label="Previous egg" style="visibility: visible;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M23 16v1h-1v1h-1v1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-1v-1h-2v1h-1v1H9v1H8v1H7v1H6v1H5v1H4v1H3v-1H2v-1H1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1v-1h1V9h1V8h1V7h1V6h2v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1z"/></svg>
            </button>
            <div class="watch-carousel-center">
              <div class="sprite-shell">
                <div class="sprite"></div>
              </div>
            </div>
            <button type="button" class="watch-carousel-arrow watch-carousel-arrow-right" aria-label="Next egg" style="visibility: visible;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#fff" d="M23 8v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-1v1h-2v-1h-1v-1H9v-1H8v-1H7v-1H6v-1H5v-1H4v-1H3v-1H2V9H1V8h1V7h1V6h1v1h1v1h1v1h1v1h1v1h1v1h1v1h1v1h2v-1h1v-1h1v-1h1v-1h1V9h1V8h1V7h1V6h1v1h1v1z"/></svg>
            </button>
          </div>
        </div>

        <script nonce="${nonce}">
          // document.documentElement.style.setProperty('--bg', \`url(${bgUri})\`);
          window.SPRITES_URL_TPL = "${spriteUriTpl}"; 
        </script>

        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;
  }

  postMessage(message: ServerMessage) {
    this.logger.logFromMessage(message);
    this.view?.webview.postMessage(message);
  }

  private async onViewReady() {
    this.state.loadState();
    const state = this.state.get();

    this.postMessage({
      type: STATE_CHANGED,
      data: state,
    });

    if (state.petId === null) {
      const eggs = this.pets.getEggs();
      this.postMessage({
        type: EGGS_AVAILABLE,
        data: eggs,
      });
      return;
    }

    const pet = this.pets.getPet(state.petId);

    if (!pet) {
      console.error(`Pet with id "${state.petId}" not found`);
      return;
    }

    this.postMessage({
      type: PET_LOADED,
      data: pet,
    });
  }

  private onEggSelected(petId: PetId) {
    const pet = this.pets.getPet(petId);
    if (!pet) {
      console.error(`Pet with id "${petId}" not found`);
      return;
    }

    this.state.setPet(petId, pet.level);
    const state = this.state.get();


    this.postMessage({
      type: STATE_CHANGED,
      data: state,
    });

    this.postMessage({
      type: PET_LOADED,
      data: pet,
    });
  }
}