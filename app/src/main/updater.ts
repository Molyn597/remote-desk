import { readFileSync } from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../preload/api';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Squirrel.Mac only installs updates into apps signed with an Apple Developer ID,
// so on macOS (and in development) updates are announced and downloaded by hand.
const canInstall = process.platform === 'win32';

let state: UpdateState = { status: app.isPackaged ? 'idle' : 'unsupported', canInstall };
let notify: (state: UpdateState) => void = () => {};

function setState(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  notify(state);
}

// Written by electron-builder into the packaged app from the "publish" config.
function releasesUrl(): string | undefined {
  try {
    const yml = readFileSync(path.join(process.resourcesPath, 'app-update.yml'), 'utf8');
    const owner = /^owner:\s*(\S+)/m.exec(yml)?.[1];
    const repo = /^repo:\s*(\S+)/m.exec(yml)?.[1];
    if (owner && repo && /^[\w.-]+$/.test(owner + repo)) return `https://github.com/${owner}/${repo}/releases/latest`;
  } catch {
    // not packaged or no publish config
  }
}

export function getUpdateState() {
  return state;
}

export async function checkForUpdates() {
  if (!app.isPackaged) return;
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    setState({ status: 'error', error: String((err as Error).message ?? err) });
  }
}

export function installUpdate() {
  if (canInstall && state.status === 'ready') autoUpdater.quitAndInstall();
}

export function openDownloadPage() {
  const url = releasesUrl();
  if (url) void shell.openExternal(url);
}

export function setupUpdater(onChange: (state: UpdateState) => void) {
  notify = onChange;
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = canInstall;
  autoUpdater.autoInstallOnAppQuit = canInstall;
  autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: undefined }));
  autoUpdater.on('update-not-available', () => setState({ status: 'latest' }));
  autoUpdater.on('update-available', (info) =>
    setState({ status: canInstall ? 'downloading' : 'available', version: info.version }),
  );
  autoUpdater.on('update-downloaded', (info) => setState({ status: 'ready', version: info.version }));
  autoUpdater.on('error', (err) => setState({ status: 'error', error: err.message }));

  void checkForUpdates();
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}
