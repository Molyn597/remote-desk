import { execFile } from 'node:child_process';
import os from 'node:os';
import { readFile, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import path from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
  net,
  desktopCapturer,
  dialog,
  ipcMain,
  Menu,
  screen,
  session,
  shell,
  systemPreferences,
  type MenuItemConstructorOptions,
} from 'electron';
import type {
  ConfirmChoice,
  ConfirmResult,
  ConfirmText,
  DeepLink,
  PermissionKind,
  SessionAction,
  SessionPanelInfo,
  SessionState,
} from '../preload/api';
import { applyTrayState, cleanTrayState, keepAliveOnClose, setRunAtLogin, startedHidden } from './background';
import { listDisplays, viewRect } from './displays';
import { clearLog, errorText, log, logFile, logStartup, readLog } from './log';
import { setKeepAwake, setSessionAwake } from './power';
import { handleInput, resetInput, setInputView, setLocalActivityHandler, watchLocalMouse } from './input';
import { privacyOn, setPrivacyScreen } from './privacy';
import { runPowerAction } from './power-actions';
import { POWER_ACTIONS, type PowerAction } from '../../../shared/protocol';
import { watchClipboard, writeClipboard } from './clipboard';
import { clearOffers, offerFiles, readOfferedFile, saveReceivedFile, wasSaved } from './files';
import { appId, rawFileUrl, repoUrl } from './repo';
import { checkForUpdates, getUpdateState, installUpdate, openDownloadPage, setupUpdater } from './updater';

const isMac = process.platform === 'darwin';
const PRIVACY_PANES: Record<PermissionKind, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

// Lets several instances run side by side during development.
if (process.env.RD_USER_DATA) app.setPath('userData', process.env.RD_USER_DATA);

let win: BrowserWindow | undefined;
let panel: BrowserWindow | undefined;
let sessionState: SessionState = 'idle';
let captureTarget: string | undefined;
let hiddenStart = false;
let lastBackground: boolean | undefined;

const PANEL_SIZE = { width: 740, height: 64 };
const TITLE_BAR_HEIGHT = 36;
const TITLE_BAR = {
  light: { color: '#e9ebec', symbolColor: '#1c1d1f' },
  dark: { color: '#131415', symbolColor: '#eceef0' },
};
const MAX_CHANGELOG_BYTES = 200_000;
const OS_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

// Changelog of a published version, so "What's new" can show it before updating.
async function fetchChangelog(version: unknown): Promise<string | null> {
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) return null;
  const url = rawFileUrl(`v${version}`, 'CHANGELOG.md');
  if (!url) return null;
  try {
    const res = await net.fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    return text.length <= MAX_CHANGELOG_BYTES ? text : null;
  } catch {
    return null;
  }
}

function openFeedback(kind: unknown) {
  const template = kind === 'bug' ? 'bug_report.yml' : kind === 'idea' ? 'feature_request.yml' : null;
  const os = `${OS_NAMES[process.platform] ?? process.platform} ${process.getSystemVersion()} (${process.arch})`;
  const query = new URLSearchParams({ template: template ?? '', version: app.getVersion(), os });
  const url = template && repoUrl(`/issues/new?${query}`);
  if (url) void shell.openExternal(url);
}

// While viewing a remote screen, shortcuts like Cmd+C or Cmd+W must reach the
// remote computer, so the menu keeps only the app submenu (Quit).
function setMenu(viewing: boolean) {
  const template: MenuItemConstructorOptions[] = [];
  if (isMac) template.push({ role: 'appMenu' });
  if (!viewing) {
    template.push({ role: 'editMenu' });
    if (!app.isPackaged) {
      template.push({ label: 'Develop', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }] });
    }
  }
  Menu.setApplicationMenu(template.length ? Menu.buildFromTemplate(template) : null);
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createWindow(hidden = false) {
  rendererReady = false;
  win = new BrowserWindow({
    show: !hidden,
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: 'Remote Desk',
    backgroundColor: '#e9ebec',
    // macOS: traffic lights over our header. Windows/Linux: native buttons drawn over
    // our own header (window controls overlay) instead of a white system title bar.
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    ...(isMac ? {} : { titleBarOverlay: { ...TITLE_BAR.light, height: TITLE_BAR_HEIGHT } }),
    autoHideMenuBar: !isMac,
    ...(isMac ? {} : { icon: APP_ICON }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      // Showing all monitors draws them into one picture, which must keep going while minimised.
      backgroundThrottling: false,
    },
  });
  win.webContents.on('render-process-gone', (_e, details) =>
    log('error', 'main', `window process gone: ${details.reason} (exit code ${details.exitCode})`),
  );
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  keepAliveOnClose(win);
  // Three-finger swipes (when macOS is set to swipe between pages with three fingers).
  win.on('swipe', (_e, direction) => win?.webContents.send('swipe', direction));
  win.on('closed', () => {
    win = undefined;
    panel?.close();
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

// Always-on-top bar shown while this computer is being viewed, so the session
// stays visible even when the Remote Desk window is hidden behind other apps.
function showSessionPanel(info: SessionPanelInfo | null) {
  if (!info) {
    panel?.close();
    return;
  }
  if (!panel) {
    const { workArea } = screen.getPrimaryDisplay();
    panel = new BrowserWindow({
      ...PANEL_SIZE,
      x: Math.round(workArea.x + (workArea.width - PANEL_SIZE.width) / 2),
      y: workArea.y + 10,
      frame: false,
      transparent: true,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: true,
      },
    });
    panel.setAlwaysOnTop(true, 'screen-saver');
    panel.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    panel.webContents.on('will-navigate', (e) => e.preventDefault());
    panel.on('closed', () => (panel = undefined));
    panel.loadFile(path.join(__dirname, 'session.html'));
    panel.once('ready-to-show', () => panel?.showInactive());
  }
  const send = () => panel?.webContents.send('session-panel-info', info);
  if (panel.webContents.isLoading()) panel.webContents.once('did-finish-load', send);
  else send();
}

// Someone at this computer moved the mouse: the privacy screen must never lock them out.
setLocalActivityHandler(() => {
  if (!privacyOn()) return;
  setPrivacyScreen(false);
  win?.webContents.send('privacy-off');
});

function onSessionState(state: SessionState) {
  if (state !== sessionState) log('info', 'session', `state ${sessionState} -> ${state}`);
  setSessionAwake(state === 'host');
  if (state !== 'host') {
    setPrivacyScreen(false);
    resetInput();
    captureTarget = undefined;
    showSessionPanel(null);
  }
  if (state === 'idle') {
    void watchClipboard(false, () => {}, () => {});
    clearOffers();
  }
  sessionState = state;
  watchLocalMouse(state === 'host');
  setMenu(state === 'viewer');
}

const APP_ICON = path.join(__dirname, 'icon.png');

// System sound can be captured on Windows, and on macOS 14.2+ (Darwin 23.2) via Core Audio taps.
const systemAudio = (() => {
  if (process.platform === 'win32') return true;
  if (process.platform !== 'darwin') return false;
  const [major, minor] = os.release().split('.').map(Number);
  return major > 23 || (major === 23 && minor >= 2);
})();

// The UI follows the system language (Czech or English), not the app bundle's locale.
const systemLocale = () => app.getPreferredSystemLanguages()[0] ?? app.getLocale();

// Running from Downloads or a mounted DMG breaks the Dock icon, Launchpad and updates.
async function offerMoveToApplications() {
  if (!isMac || !app.isPackaged || app.isInApplicationsFolder()) return;
  const prefsPath = path.join(app.getPath('userData'), 'prefs.json');
  const prefs = await readFile(prefsPath, 'utf8')
    .then((text) => JSON.parse(text))
    .catch(() => ({}));
  if (prefs.skipMoveToApplications) return;
  const cs = systemLocale().toLowerCase().startsWith('cs');
  const { response, checkboxChecked } = await dialog.showMessageBox({
    type: 'question',
    buttons: cs ? ['Přesunout do Aplikací', 'Teď ne'] : ['Move to Applications', 'Not now'],
    defaultId: 0,
    cancelId: 1,
    message: cs ? 'Přesunout Remote Desk do složky Aplikace?' : 'Move Remote Desk to the Applications folder?',
    detail: cs
      ? 'Aplikaci pak spustíte z Launchpadu nebo Docku a aktualizace budou fungovat správně.'
      : 'You can then open it from Launchpad or the Dock, and updates work correctly.',
    checkboxLabel: cs ? 'Už se neptat' : "Don't ask again",
  });
  if (response === 0) {
    try {
      app.moveToApplicationsFolder();
    } catch (err) {
      dialog.showErrorBox('Remote Desk', String((err as Error).message ?? err));
    }
  } else if (checkboxChecked) {
    await writeFile(prefsPath, JSON.stringify({ ...prefs, skipMoveToApplications: true })).catch(() => {});
  }
}

const fromMainWindow = (e: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => e.sender === win?.webContents;

const TCC_SERVICES: Record<PermissionKind, string> = { screen: 'ScreenCapture', accessibility: 'Accessibility' };

// Removes this app's stale entry (e.g. granted to an older, differently signed
// version) so macOS asks again for the current app. Only touches our own bundle.
async function resetPermission(kind: PermissionKind): Promise<boolean> {
  if (!isMac || !app.isPackaged || !appId || !(kind in TCC_SERVICES)) return false;
  try {
    await promisify(execFile)('/usr/bin/tccutil', ['reset', TCC_SERVICES[kind], appId]);
  } catch (err) {
    log('error', 'permission', `resetting ${kind} failed: ${errorText(err)}`);
    return false;
  }
  await requestPermission(kind);
  return true;
}

async function requestPermission(kind: PermissionKind) {
  if (!isMac) return;
  // Asking once makes macOS list the app in System Settings.
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
  else await desktopCapturer.getSources({ types: ['screen'] }).catch(() => []);
  await shell.openExternal(PRIVACY_PANES[kind]);
}

// One instance only: launching again (or from the login item) brings up the running one.
if (!app.requestSingleInstanceLock()) app.exit(0);

// remotedesk://connect/123456789 links (Shortcuts, Raycast, Stream Deck, a desktop shortcut…).
// A link only names a computer: favorites connect right away, others just fill in the ID.
const PROTOCOL = 'remotedesk';
let pendingLink: DeepLink | undefined;
let rendererReady = false;

function parseLink(url: unknown): DeepLink | undefined {
  const match = /^remotedesk:\/\/connect\/(\d{3})[ -]?(\d{3})[ -]?(\d{3})\/?$/i.exec(decodeURIComponent(String(url ?? '')));
  return match ? { action: 'connect', id: match.slice(1).join('') } : undefined;
}

function handleLink(url: unknown) {
  const link = parseLink(url);
  if (!link) return;
  log('info', 'link', `opened ${PROTOCOL}://connect/${link.id}`);
  if (!win || !rendererReady) {
    pendingLink = link;
    return;
  }
  showWindow();
  win.webContents.send('deep-link', link);
}

const linkInArgs = (argv: string[]) => argv.find((arg) => arg.toLowerCase().startsWith(`${PROTOCOL}://`));

if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL);
// macOS delivers links as events, also the one that launched the app.
app.on('open-url', (e, url) => {
  e.preventDefault();
  handleLink(url);
});
// Windows passes the link on the command line.
handleLink(linkInArgs(process.argv));

app.whenReady().then(async () => {
  logStartup();
  if (isMac) {
    log('info', 'permission', `screen recording ${systemPreferences.getMediaAccessStatus('screen')}, accessibility ${systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not granted'}`);
  }
  await offerMoveToApplications();
  // The packaged app takes its icon from the bundle; during development show ours too.
  if (isMac && !app.isPackaged) app.dock?.setIcon(APP_ICON);

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.frame?.url.startsWith('file://')) return callback(null);
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const primaryId = String(screen.getPrimaryDisplay().id);
      const source =
        sources.find((s) => s.display_id === captureTarget) ?? sources.find((s) => s.display_id === primaryId) ?? sources[0];
      callback(source ? { video: source, ...(request.audioRequested && systemAudio ? { audio: 'loopback' } : {}) } : null);
    } catch (err) {
      log('error', 'capture', `screen capture unavailable: ${errorText(err)}`);
      callback(null);
    }
  });

  // The window is ready for links; hand over one that arrived while it was loading.
  ipcMain.handle('deep-link-ready', (e) => {
    if (!fromMainWindow(e)) return null;
    rendererReady = true;
    const link = pendingLink;
    pendingLink = undefined;
    return link ?? null;
  });
  ipcMain.on('privacy-screen', (e, enabled: unknown, message: unknown) => {
    if (fromMainWindow(e) && sessionState === 'host') setPrivacyScreen(enabled === true, String(message ?? '').slice(0, 300), panel);
  });
  ipcMain.on('keep-awake', (e, enabled: unknown) => {
    if (fromMainWindow(e)) setKeepAwake(enabled === true);
  });
  ipcMain.on('tray-state', (e, raw: unknown) => {
    if (!fromMainWindow(e) || !win) return;
    const state = cleanTrayState(raw);
    if (state.background !== lastBackground) setRunAtLogin(state.background);
    lastBackground = state.background;
    // Started hidden at login but background mode is off by now: nothing would show the window.
    if (!state.background && !win.isVisible()) showWindow();
    applyTrayState(state, showWindow, (action) => {
      // Connecting and copying need the window's state; the window shows itself when it connects.
      if (action.type === 'connect') showWindow();
      win?.webContents.send('tray-action', action);
    });
  });
  ipcMain.on('log', (e, level, source, message) => {
    if (fromMainWindow(e)) log(level, `${String(source).slice(0, 10)}`, message);
  });
  ipcMain.handle('log-read', (e) => (fromMainWindow(e) ? readLog() : ''));
  ipcMain.on('log-clear', (e) => {
    if (fromMainWindow(e)) clearLog();
  });
  ipcMain.on('log-reveal', (e) => {
    if (fromMainWindow(e)) shell.showItemInFolder(logFile());
  });
  ipcMain.handle('config', () => ({
    platform: process.platform,
    locale: systemLocale(),
    version: app.getVersion(),
  }));
  ipcMain.handle('permissions', () => ({
    screen: isMac ? systemPreferences.getMediaAccessStatus('screen') : 'granted',
    accessibility: isMac ? systemPreferences.isTrustedAccessibilityClient(false) : true,
  }));
  ipcMain.handle('request-permission', (_e, kind: PermissionKind) => requestPermission(kind));
  ipcMain.handle('reset-permission', (e, kind: PermissionKind) => (fromMainWindow(e) ? resetPermission(kind) : false));
  ipcMain.on('clipboard-watch', (e, enabled: boolean) => {
    if (!fromMainWindow(e)) return;
    void watchClipboard(
      Boolean(enabled),
      (text) => win?.webContents.send('clipboard-changed', text),
      async (paths) => {
        if (sessionState !== 'host') return;
        const offers = await offerFiles(paths);
        if (offers.length) win?.webContents.send('clipboard-files', offers);
      },
    );
  });
  // The picker opens on the host's screen, where the viewer chooses files remotely.
  ipcMain.handle('pick-files', async (e, title: unknown) => {
    if (!win || !fromMainWindow(e) || sessionState !== 'host') return [];
    win.show();
    app.focus({ steal: true });
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: String(title ?? ''),
      properties: ['openFile', 'multiSelections'],
    });
    return canceled ? [] : offerFiles(filePaths);
  });
  ipcMain.handle('read-offered', (e, id: unknown) =>
    fromMainWindow(e) && sessionState === 'host' ? readOfferedFile(id) : null,
  );
  ipcMain.on('set-theme', (e, theme: unknown) => {
    if (fromMainWindow(e) && !isMac && (theme === 'light' || theme === 'dark')) win?.setTitleBarOverlay(TITLE_BAR[theme]);
  });
  ipcMain.on('clipboard-write', (e, text: unknown) => {
    if (fromMainWindow(e) && sessionState !== 'idle') void writeClipboard(text);
  });
  ipcMain.handle('save-file', (e, name: unknown, data: unknown) =>
    fromMainWindow(e) && sessionState !== 'idle' ? saveReceivedFile(name, data) : null,
  );
  ipcMain.on('reveal-file', (e, target: unknown) => {
    if (fromMainWindow(e) && wasSaved(target)) shell.showItemInFolder(target as string);
  });
  ipcMain.on('relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.on('copy-text', (_e, text: string) => void clipboard.writeText(String(text)));
  ipcMain.handle('confirm-connection', async (e, text: ConfirmText): Promise<ConfirmResult> => {
    if (!win || !fromMainWindow(e)) return { choice: 'deny', remember: false };
    if (win.isMinimized()) win.restore();
    win.show();
    app.focus({ steal: true });
    const choices: ConfirmChoice[] = ['control', 'view', 'deny'];
    const { response, checkboxChecked } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [text.allowControl, text.allowView, text.deny],
      defaultId: 2,
      cancelId: 2,
      message: text.title,
      detail: text.detail,
      ...(text.remember ? { checkboxLabel: text.remember, checkboxChecked: false } : {}),
      // Nobody answering counts as Deny.
      signal: AbortSignal.timeout(60_000),
    });
    const choice = choices[response] ?? 'deny';
    return { choice, remember: choice !== 'deny' && checkboxChecked };
  });
  ipcMain.on('session-state', (e, state: SessionState) => {
    if (fromMainWindow(e)) onSessionState(state);
  });
  ipcMain.on('session-panel', (e, info: SessionPanelInfo | null) => {
    if (fromMainWindow(e)) showSessionPanel(sessionState === 'host' ? info : null);
  });
  ipcMain.on('session-action', (e, action: SessionAction) => {
    if (e.sender !== panel?.webContents) return;
    if (action === 'pause' || action === 'resume' || action === 'disconnect') {
      win?.webContents.send('session-action', action);
    }
  });
  ipcMain.handle('displays', (e) => (fromMainWindow(e) ? listDisplays() : []));
  // The next screen capture records this monitor (one getDisplayMedia call per monitor).
  ipcMain.handle('capture-target', (e, id: unknown) => {
    if (fromMainWindow(e)) captureTarget = typeof id === 'string' ? id : undefined;
  });
  ipcMain.on('input-view', (e, view: unknown) => {
    if (sessionState === 'host' && fromMainWindow(e)) setInputView(viewRect(view));
  });
  ipcMain.on('power-action', (e, action: unknown) => {
    if (sessionState !== 'host' || !fromMainWindow(e) || !POWER_ACTIONS.includes(action as PowerAction)) return;
    // Give the renderer a moment to tell the viewer before the screen locks or the PC goes down.
    setTimeout(() => runPowerAction(action as PowerAction), 600);
  });
  ipcMain.on('input', (e, ev) => {
    if (sessionState !== 'host' || !fromMainWindow(e)) return;
    try {
      handleInput(ev);
    } catch (err) {
      log('error', 'input', `input failed: ${errorText(err)}`);
    }
  });

  ipcMain.handle('changelog', () => readFile(path.join(__dirname, 'CHANGELOG.md'), 'utf8').catch(() => ''));
  ipcMain.handle('changelog-remote', (_e, version) => fetchChangelog(version));
  ipcMain.on('open-feedback', (e, kind) => {
    if (fromMainWindow(e)) openFeedback(kind);
  });
  ipcMain.handle('update-state', () => getUpdateState());
  ipcMain.on('update-check', (e) => {
    if (fromMainWindow(e)) void checkForUpdates();
  });
  ipcMain.on('update-install', (e) => {
    if (fromMainWindow(e)) installUpdate();
  });
  ipcMain.on('update-download-page', (e) => {
    if (fromMainWindow(e)) openDownloadPage();
  });

  setMenu(false);
  hiddenStart = startedHidden();
  createWindow(hiddenStart);
  setupUpdater((state) => win?.webContents.send('update-state', state));
});

app.on('second-instance', (_e, argv) => {
  const link = linkInArgs(argv);
  if (link) handleLink(link);
  else showWindow();
});
// macOS also sends 'activate' right after launch; a login start stays hidden.
app.on('activate', () => {
  if (app.isReady() && !(hiddenStart && process.uptime() < 5)) showWindow();
});

app.on('window-all-closed', () => {
  resetInput();
  app.quit();
});
