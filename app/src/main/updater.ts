import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../preload/api';
import { allowQuit } from './background';
import { log } from './log';
import { repoUrl } from './repo';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Windows and macOS install updates in place. On macOS this needs every release
// signed with the same certificate; if Squirrel.Mac rejects an update (e.g. an
// ad-hoc signed local build) we fall back to a manual download.
let canInstall = process.platform === 'win32' || process.platform === 'darwin';

let state: UpdateState = { status: app.isPackaged ? 'idle' : 'unsupported', canInstall };
let notify: (state: UpdateState) => void = () => {};

// Update channel: stable releases only, or betas too. A beta installed by hand starts on the
// beta channel. Leaving it goes back to the newest stable release, even if its number is lower.
const isPrerelease = (version: string) => version.includes('-');
const prefsPath = () => path.join(app.getPath('userData'), 'prefs.json');
const readPrefs = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(prefsPath(), 'utf8'));
  } catch {
    return {};
  }
};
let beta = false;

// On the beta channel electron-updater takes the newest release of any kind and falls back to
// latest*.yml when a release has no beta*.yml, so stable releases are offered to betas too.
function applyChannel() {
  autoUpdater.allowPrerelease = beta;
  autoUpdater.channel = beta ? 'beta' : 'latest';
  autoUpdater.allowDowngrade = !beta && isPrerelease(app.getVersion());
}

export const getBetaChannel = () => beta;

export function setBetaChannel(enabled: boolean) {
  if (enabled === beta) return;
  beta = enabled;
  try {
    writeFileSync(prefsPath(), JSON.stringify({ ...readPrefs(), betaUpdates: enabled }));
  } catch {
    // stays for this run
  }
  log('info', 'update', `channel: ${enabled ? 'beta' : 'stable'}`);
  if (!app.isPackaged) return;
  applyChannel();
  void checkForUpdates();
}

function setState(next: Partial<UpdateState>) {
  const previous = state;
  state = { ...state, ...next };
  if (state.status !== previous.status || state.error !== previous.error) {
    const detail = [state.version && `version ${state.version}`, state.error].filter(Boolean).join(', ');
    log(state.status === 'error' || state.error ? 'warn' : 'info', 'update', `${state.status}${detail ? ` (${detail})` : ''}`);
  }
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
  if (!canInstall || state.status !== 'ready') return;
  log('info', 'update', `installing ${state.version ?? ''} and restarting`);
  allowQuit();
  autoUpdater.quitAndInstall();
}

export function openDownloadPage() {
  const url = repoUrl(beta ? '/releases' : '/releases/latest');
  if (url) void shell.openExternal(url);
}

export function setupUpdater(onChange: (state: UpdateState) => void) {
  notify = onChange;
  const saved = readPrefs().betaUpdates;
  beta = typeof saved === 'boolean' ? saved : isPrerelease(app.getVersion());
  if (!app.isPackaged) return;
  applyChannel();

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
