import { readFile, writeFile } from 'node:fs/promises';
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
  ConfirmText,
  PermissionKind,
  SessionAction,
  SessionPanelInfo,
  SessionState,
} from '../preload/api';
import { handleInput, resetInput, watchLocalMouse } from './input';
import { rawFileUrl, repoUrl } from './repo';
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

const PANEL_SIZE = { width: 740, height: 64 };
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

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    title: 'Remote Desk',
    backgroundColor: '#e9ebec',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: !isMac,
    ...(isMac ? {} : { icon: APP_ICON }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
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

function onSessionState(state: SessionState) {
  if (state !== 'host') {
    resetInput();
    showSessionPanel(null);
  }
  sessionState = state;
  watchLocalMouse(state === 'host');
  setMenu(state === 'viewer');
}

const APP_ICON = path.join(__dirname, 'icon.png');

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

async function requestPermission(kind: PermissionKind) {
  if (!isMac) return;
  // Asking once makes macOS list the app in System Settings.
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
  else await desktopCapturer.getSources({ types: ['screen'] }).catch(() => []);
  await shell.openExternal(PRIVACY_PANES[kind]);
}

app.whenReady().then(async () => {
  await offerMoveToApplications();
  // The packaged app takes its icon from the bundle; during development show ours too.
  if (isMac && !app.isPackaged) app.dock?.setIcon(APP_ICON);

  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.frame?.url.startsWith('file://')) return callback(null);
    try {
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const primaryId = String(screen.getPrimaryDisplay().id);
      const source = sources.find((s) => s.display_id === primaryId) ?? sources[0];
      callback(source ? { video: source } : null);
    } catch (err) {
      console.error('screen capture unavailable', err);
      callback(null);
    }
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
  ipcMain.on('relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
  ipcMain.on('copy-text', (_e, text: string) => clipboard.writeText(String(text)));
  ipcMain.handle('confirm-connection', async (e, text: ConfirmText): Promise<ConfirmChoice> => {
    if (!win || !fromMainWindow(e)) return 'deny';
    if (win.isMinimized()) win.restore();
    win.show();
    app.focus({ steal: true });
    const choices: ConfirmChoice[] = ['control', 'view', 'deny'];
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [text.allowControl, text.allowView, text.deny],
      defaultId: 2,
      cancelId: 2,
      message: text.title,
      detail: text.detail,
    });
    return choices[response] ?? 'deny';
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
  ipcMain.on('input', (e, ev) => {
    if (sessionState !== 'host' || !fromMainWindow(e)) return;
    try {
      handleInput(ev);
    } catch (err) {
      console.error('input failed', err);
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
  createWindow();
  setupUpdater((state) => win?.webContents.send('update-state', state));
});

app.on('window-all-closed', () => {
  resetInput();
  app.quit();
});
