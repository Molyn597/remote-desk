import path from 'node:path';
import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';

// Windows/Linux pass this flag from the login item so the app starts without a window.
const HIDDEN_FLAG = '--hidden';
const loginOptions = () => (process.platform === 'win32' ? { args: [HIDDEN_FLAG] } : {});

export type BackgroundLabels = { open: string; quit: string; tooltip: string };

let tray: Tray | undefined;
let quitting = false;

app.on('before-quit', () => {
  quitting = true;
});

// quitAndInstall closes the windows before 'before-quit', so it must say up front that
// this is a real quit, not the window going to the tray.
export function allowQuit() {
  quitting = true;
}

export const runsAtLogin = () => app.getLoginItemSettings(loginOptions()).openAtLogin;

export const startedHidden = () =>
  process.argv.includes(HIDDEN_FLAG) || (process.platform === 'darwin' && app.getLoginItemSettings().wasOpenedAtLogin);

// Start at login and keep running in the tray/menu bar when the window is closed,
// so trusted devices can connect while nobody is at this computer.
export function setRunAtLogin(enabled: boolean) {
  if (!app.isPackaged) return; // a dev build would register the bare Electron binary
  app.setLoginItemSettings({ openAtLogin: enabled, ...loginOptions() });
}

export function setupBackground(enabled: boolean, show: () => void, labels: BackgroundLabels) {
  if (!enabled) {
    tray?.destroy();
    tray = undefined;
    return;
  }
  if (!tray) {
    const icon =
      process.platform === 'darwin'
        ? nativeImage.createFromPath(path.join(__dirname, 'trayTemplate.png'))
        : nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 16, height: 16 });
    if (process.platform === 'darwin') icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.on('click', show);
  }
  tray.setToolTip(labels.tooltip);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: labels.open, click: show },
      { type: 'separator' },
      { label: labels.quit, click: () => app.quit() },
    ]),
  );
}

// While running in the background, closing the window only hides it.
export function keepAliveOnClose(win: BrowserWindow) {
  win.on('close', (e) => {
    if (tray && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}
