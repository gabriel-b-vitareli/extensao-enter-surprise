const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

const IMAGE_EXT = new Set(['.gif', '.webp', '.png', '.jpg', '.jpeg']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);

// Enter = quebra de linha + indentação automática (e variação com bracket expandido: "{\n\t\n}")
const ENTER_RE = /^\r?\n[ \t]*(\r?\n[ \t]*)?$/;

let panel = null;
let lastShown = 0;
let statusItem;
let warnedEmpty = false;

const cfg = () => vscode.workspace.getConfiguration('enterSurprise');

function activate(context) {
  statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 0);
  statusItem.command = 'enterSurprise.toggle';
  context.subscriptions.push(statusItem);
  updateStatus();

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => onChange(e, context)),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('enterSurprise')) updateStatus();
    }),
    vscode.commands.registerCommand('enterSurprise.toggle', async () => {
      await cfg().update('enabled', !cfg().get('enabled'), vscode.ConfigurationTarget.Global);
      updateStatus();
    }),
    vscode.commands.registerCommand('enterSurprise.triggerNow', () => show(context, true)),
    vscode.commands.registerCommand('enterSurprise.chooseFolder', async () => {
      const pick = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Usar esta pasta',
      });
      if (pick && pick[0]) {
        await cfg().update('mediaFolder', pick[0].fsPath, vscode.ConfigurationTarget.Global);
        warnedEmpty = false;
        vscode.window.showInformationMessage(`Pasta definida: ${pick[0].fsPath}`);
      }
    })
  );
}

function updateStatus() {
  const on = cfg().get('enabled');
  statusItem.text = on ? `$(sparkle) Enter ${cfg().get('chancePercent')}%` : '$(circle-slash) Enter Surprise';
  statusItem.tooltip = 'Enter Surprise — clique para ligar/desligar';
  statusItem.show();
}

function onChange(e, context) {
  if (!cfg().get('enabled')) return;
  if (e.reason) return; // ignora undo/redo
  const scheme = e.document.uri.scheme;
  if (scheme !== 'file' && scheme !== 'untitled') return;
  const active = vscode.window.activeTextEditor;
  if (!active || active.document !== e.document) return; // só edições feitas pelo usuário no editor ativo
  if (!e.contentChanges.some((c) => ENTER_RE.test(c.text))) return;
  show(context, false);
}

function mediaFolder(context) {
  const f = (cfg().get('mediaFolder') || '').trim();
  return f || path.join(context.extensionPath, 'media');
}

function collectMedia(context) {
  const folder = mediaFolder(context);
  const items = [];
  try {
    for (const name of fs.readdirSync(folder)) {
      const ext = path.extname(name).toLowerCase();
      if (IMAGE_EXT.has(ext)) items.push({ kind: 'image', file: path.join(folder, name) });
      else if (VIDEO_EXT.has(ext)) items.push({ kind: 'video', file: path.join(folder, name) });
    }
  } catch (_) { /* pasta inexistente */ }

  for (const url of cfg().get('urls') || []) {
    if (!/^https:\/\//i.test(url)) continue;
    const ext = path.extname(url.split('?')[0]).toLowerCase();
    items.push({ kind: VIDEO_EXT.has(ext) ? 'video' : 'image', url });
  }
  return items;
}

function show(context, force) {
  if (panel) return;
  if (!force) {
    const now = Date.now();
    if (now - lastShown < cfg().get('cooldownSeconds') * 1000) return;
    if (Math.random() * 100 >= cfg().get('chancePercent')) return;
  }

  const items = collectMedia(context);
  if (!items.length) {
    if (!warnedEmpty || force) {
      warnedEmpty = true;
      vscode.window
        .showWarningMessage('Enter Surprise: nenhum GIF/vídeo encontrado.', 'Escolher pasta')
        .then((c) => c && vscode.commands.executeCommand('enterSurprise.chooseFolder'));
    }
    return;
  }

  const item = items[Math.floor(Math.random() * items.length)];
  lastShown = Date.now();

  const roots = item.file ? [vscode.Uri.file(path.dirname(item.file))] : [];
  panel = vscode.window.createWebviewPanel(
    'enterSurprise',
    '🎉',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, // não rouba o foco do editor
    { enableScripts: true, localResourceRoots: roots }
  );

  const src = item.file ? panel.webview.asWebviewUri(vscode.Uri.file(item.file)).toString() : item.url;
  panel.webview.html = html(panel.webview, item.kind, src, cfg().get('videoMuted'));

  const close = () => panel && panel.dispose();
  const timeout = setTimeout(close, item.kind === 'video' ? 120000 : cfg().get('imageDurationMs'));
  panel.webview.onDidReceiveMessage((m) => m === 'done' && close());
  panel.onDidDispose(() => {
    clearTimeout(timeout);
    panel = null;
  });
}

function html(webview, kind, src, muted) {
  const nonce = Math.random().toString(36).slice(2);
  const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; media-src ${webview.cspSource} https:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const body =
    kind === 'video'
      ? `<video id="v" src="${src}" autoplay playsinline ${muted ? 'muted' : ''}></video>`
      : `<img src="${src}">`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
  html,body{margin:0;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
  img,video{max-width:100%;max-height:100%}
</style></head><body>${body}
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const v = document.getElementById('v');
  if (v) { v.addEventListener('ended', () => vscode.postMessage('done')); v.addEventListener('error', () => vscode.postMessage('done')); }
</script></body></html>`;
}

function deactivate() {}

module.exports = { activate, deactivate };
