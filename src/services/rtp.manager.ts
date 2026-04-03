
import vscode from 'vscode';
import { Achievement, Pet, PetId } from '../types';

export class RunTimePackageManager {

  constructor(
    private baseUri: vscode.Uri
  ) {}

  getPanelIconPath() {
    return vscode.Uri.joinPath(
      this.baseUri,
      `icon-${vscode.window.activeColorTheme.kind === vscode.ColorThemeKind.Dark ? 'dark' : 'light'}.png`
    );
  }

  getSpritesPath(){
    return vscode.Uri.joinPath(
      this.baseUri,
      "sprites"
    );
  }

  getSpritesBaseUri(webview: vscode.Webview) {
    return webview.asWebviewUri(
      this.getSpritesPath()
    );
  }

  getSpriteUri(baseUri: vscode.Uri, petId: PetId) {
    return `${baseUri}/${petId.toString().padStart(4, '0')}.png`;
  }

  getDataPath(){
    return vscode.Uri.joinPath(
      this.baseUri,
      "data.json"
    );
  }

  getAchievementsPath(){
    return vscode.Uri.joinPath(
      this.baseUri,
      "achievements.json"
    );
  }

  async load() {
    const [achievements, pets] = await Promise.all([
      this.loadAchievements(),
      this.loadPets()
    ]);

    return {
      achievements,
      pets,
    };
  }
  
  async loadPets() {
    const bytes = await vscode.workspace.fs.readFile(this.getDataPath());
    const data = JSON.parse(Buffer.from(bytes).toString("utf8")) as Pet[];

    return data;
  }
  
  async loadAchievements() {
    const bytes = await vscode.workspace.fs.readFile(this.getAchievementsPath());
    const data = JSON.parse(Buffer.from(bytes).toString("utf8")) as Achievement[];

    return data;
  }
}