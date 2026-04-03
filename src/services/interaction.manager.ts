import * as vscode from "vscode";

export class InteractionManager {

  private readonly lastUserInteraction = new Map<string, number>();

  constructor(context: vscode.ExtensionContext) {
    const textEditorSelectionSub = vscode.window.onDidChangeTextEditorSelection(event => {
      if (event.textEditor.document.uri.scheme !== 'file') {return;}
      this.markInteraction(event.textEditor.document);
    });
    context.subscriptions.push(textEditorSelectionSub);
    
    const activeTextEditorSub = vscode.window.onDidChangeActiveTextEditor(editor => {
      if (!editor) {return;}
      if (editor.document.uri.scheme !== 'file') {return;}
      this.markInteraction(editor.document);
    });
    context.subscriptions.push(activeTextEditorSub);
  }

  isTouchedByUser(doc: vscode.TextDocument) {
    if (doc.uri.scheme !== 'file') {return false;}
    if (!vscode.workspace.getWorkspaceFolder(doc.uri)) {return false;}

    const uri = doc.uri.toString();

    const isVisible = vscode.window.visibleTextEditors.some(
      editor => editor.document.uri.toString() === uri
    );

    if (!isVisible) {return false;}

    const lastInteraction = this.lastUserInteraction.get(uri) ?? 0;
    const recentlyTouchedByUser = Date.now() - lastInteraction < 1500;

    if (!recentlyTouchedByUser) {return false;}

    return true;
  }
  
  private markInteraction(doc: vscode.TextDocument) {
    this.lastUserInteraction.set(doc.uri.toString(), Date.now());
  }
}