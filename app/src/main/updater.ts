import { app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../preload/api';
import { repoUrl } from './repo';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Windows and macOS install updates in place. On macOS this needs every release
// signed with the same certificate; if Squirrel.Mac rejects an update (e.g. an
// ad-hoc signed local build) we fall back to a manual download.
let canInstall = process.platform === 'win32' || process.platform === 'darwin';

let state: UpdateState = { status: app.isPackaged ? 'idle' : 'unsupported', canInstall };
let notify: (state: UpdateState) => void = () => {};

function setState(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  notify(state);
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
  const url = repoUrl('/releases/latest');
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
  autoUpdater.on('error', (err) => {
    if (process.platform === 'darwin' && state.version && state.status !== 'checking') {
      canInstall = false;
      autoUpdater.autoDownload = false;
      setState({ status: 'available', canInstall, error: err.message });
    } else {
      setState({ status: 'error', error: err.message });
    }
  });

  void checkForUpdates();
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}
