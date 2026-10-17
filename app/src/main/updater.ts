import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { app, net, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateState } from '../preload/api';
import { allowQuit } from './background';
import { log } from './log';
import { repo, repoUrl } from './repo';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Windows and macOS install updates in place. On macOS this needs every release
// signed with the same certificate; if Squirrel.Mac rejects an update (e.g. an
// ad-hoc signed local build) we fall back to a manual download.
let canInstall = process.platform === 'win32' || process.platform === 'darwin';

let state: UpdateState = { status: app.isPackaged ? 'idle' : 'unsupported', canInstall };
let notify: (state: UpdateState) => void = () => {};

// Which versions to follow: the newest stable release, the newest release including betas, or one
// chosen version (e.g. to go back), which then stays until the person picks "newest" again.
// A beta installed by hand starts on the beta track.
export type UpdateTrack = 'stable' | 'beta' | string;
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const isPrerelease = (version: string) => version.includes('-');
const prefsPath = () => path.join(app.getPath('userData'), 'prefs.json');
const readPrefs = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(prefsPath(), 'utf8'));
  } catch {
    return {};
  }
};
export const validTrack = (value: unknown): value is UpdateTrack =>
  value === 'stable' || value === 'beta' || (typeof value === 'string' && VERSION.test(value));
let track: UpdateTrack = 'stable';

// On the beta track electron-updater takes the newest release of any kind and falls back to
// latest*.yml when a release has no beta*.yml, so stable releases are offered to betas too.
// A chosen version is read straight from that release's files, older ones included.
function applyTrack() {
  if (track === 'stable' || track === 'beta') {
    if (repo) autoUpdater.setFeedURL({ provider: 'github', owner: repo.owner, repo: repo.name });
    autoUpdater.allowPrerelease = track === 'beta';
    autoUpdater.channel = track === 'beta' ? 'beta' : 'latest';
    autoUpdater.allowDowngrade = track === 'stable' && isPrerelease(app.getVersion());
  } else {
    const url = repoUrl(`/releases/download/v${track}`);
    if (url) autoUpdater.setFeedURL({ provider: 'generic', url, channel: 'latest' });
    autoUpdater.allowPrerelease = true;
    autoUpdater.channel = 'latest';
    autoUpdater.allowDowngrade = true;
  }
}

export const getUpdateTrack = () => track;

export function setUpdateTrack(next: UpdateTrack) {
  if (next === track) return;
  track = next;
  try {
    const { betaUpdates: _old, ...prefs } = readPrefs();
    writeFileSync(prefsPath(), JSON.stringify({ ...prefs, updateTrack: next }));
  } catch {
    // stays for this run
  }
  log('info', 'update', `track: ${next}`);
  if (!app.isPackaged) return;
  setState({ status: 'idle', version: undefined, error: undefined });
  applyTrack();
  void checkForUpdates();
}

export interface Release {
  version: string;
  prerelease: boolean;
  date: string;
}

// Published releases, newest first, for picking a version. Cached for a while.
let releases: { at: number; list: Release[] } | undefined;
export async function listReleases(): Promise<Release[]> {
  if (releases && Date.now() - releases.at < 10 * 60 * 1000) return releases.list;
  if (!repo) return [];
  try {
    const res = await net.fetch(`https://api.github.com/repos/${repo.owner}/${repo.name}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { tag_name: string; draft: boolean; prerelease: boolean; published_at: string }[];
    const list = data
      .filter((r) => !r.draft && VERSION.test(r.tag_name.replace(/^v/, '')))
      .map((r) => ({ version: r.tag_name.replace(/^v/, ''), prerelease: r.prerelease, date: r.published_at }));
    releases = { at: Date.now(), list };
    return list;
  } catch (err) {
    log('warn', 'update', `release list unavailable: ${(err as Error).message ?? err}`);
    return releases?.list ?? [];
  }
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
  const url = repoUrl(track === 'stable' ? '/releases/latest' : track === 'beta' ? '/releases' : `/releases/tag/v${track}`);
  if (url) void shell.openExternal(url);
}

export function setupUpdater(onChange: (state: UpdateState) => void) {
  notify = onChange;
  const prefs = readPrefs();
  // Earlier versions stored only an on/off beta switch.
  const saved = validTrack(prefs.updateTrack) ? prefs.updateTrack : typeof prefs.betaUpdates === 'boolean' ? (prefs.betaUpdates ? 'beta' : 'stable') : undefined;
  track = saved ?? (isPrerelease(app.getVersion()) ? 'beta' : 'stable');
  if (!app.isPackaged) return;
  applyTrack();

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
