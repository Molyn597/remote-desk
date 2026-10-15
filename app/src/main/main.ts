import path from 'node:path';
import {
  app,
  BrowserWindow,
  clipboard,
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
import type { ConfirmText, PermissionKind, SessionState } from '../preload/api';
import { handleInput, resetInput } from './input';

const isMac = process.platform === 'darwin';
const PRIVACY_PANES: Record<PermissionKind, string> = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
};

// Lets several instances run side by side during development.
if (process.env.RD_USER_DATA) app.setPath('userData', process.env.RD_USER_DATA);

let win: BrowserWindow | undefined;
let sessionState: SessionState = 'idle';

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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.on('closed', () => (win = undefined));
  win.loadFile(path.join(__dirname, 'index.html'));
}

function onSessionState(state: SessionState) {
  if (state !== 'host') resetInput();
  sessionState = state;
  setMenu(state === 'viewer');
}

async function requestPermission(kind: PermissionKind) {
  if (!isMac) return;
  // Asking once makes macOS list the app in System Settings.
  if (kind === 'accessibility') systemPreferences.isTrustedAccessibilityClient(true);
  else await desktopCapturer.getSources({ types: ['screen'] }).catch(() => []);
  await shell.openExternal(PRIVACY_PANES[kind]);
}

app.whenReady().then(() => {
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
    locale: app.getLocale(),
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
  ipcMain.handle('confirm-connection', async (_e, text: ConfirmText) => {
    if (!win) return false;
    if (win.isMinimized()) win.restore();
    win.show();
    app.focus({ steal: true });
    const { response } = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: [text.allow, text.deny],
      defaultId: 1,
      cancelId: 1,
      message: text.title,
      detail: text.detail,
    });
    return response === 0;
  });
  ipcMain.on('session-state', (_e, state: SessionState) => onSessionState(state));
  ipcMain.on('input', (_e, ev) => {
    if (sessionState !== 'host') return;
    try {
      handleInput(ev);
    } catch (err) {
      console.error('input failed', err);
    }
  });

  setMenu(false);
  createWindow();
});

app.on('window-all-closed', () => {
  resetInput();
  app.quit();
});
