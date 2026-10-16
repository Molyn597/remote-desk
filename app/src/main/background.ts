import path from 'node:path';
import { app, Menu, nativeImage, Tray, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import type { TrayAction, TrayState } from '../preload/api';

// Windows/Linux pass this flag from the login item so the app starts without a window.
const HIDDEN_FLAG = '--hidden';
const loginOptions = () => (process.platform === 'win32' ? { args: [HIDDEN_FLAG] } : {});

let tray: Tray | undefined;
let keepAlive = false;
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

const text = (value: unknown, max = 120) => String(value ?? '').slice(0, max);

// The renderer describes the menu; only plain labels and favorite IDs are accepted.
export function cleanTrayState(raw: unknown): TrayState {
  const s = (raw ?? {}) as Partial<TrayState>;
  return {
    background: s.background === true,
    showIcon: s.showIcon === true,
    tooltip: text(s.tooltip),
    open: text(s.open),
    quit: text(s.quit),
    favoritesTitle: text(s.favoritesTitle),
    copyId: text(s.copyId),
    copyPassword: text(s.copyPassword),
    status: s.status ? text(s.status) : undefined,
    disconnect: s.disconnect ? text(s.disconnect) : undefined,
    favorites: (Array.isArray(s.favorites) ? s.favorites : [])
      .filter((f) => /^\d{9}$/.test(String(f?.id)))
      .slice(0, 20)
      .map((f) => ({ id: String(f.id), label: text(f.label, 60) })),
  };
}

// Menu bar / tray icon and the Dock menu: favorites to connect to, this computer's ID and
// password, the current session, open and quit.
export function applyTrayState(state: TrayState, show: () => void, act: (action: TrayAction) => void) {
  keepAlive = state.background;
  const favorites: MenuItemConstructorOptions[] = state.favorites.length
    ? [
        { label: state.favoritesTitle, enabled: false },
        ...state.favorites.map((f) => ({ label: f.label, click: () => act({ type: 'connect', id: f.id }) })),
        { type: 'separator' as const },
      ]
    : [];
  const share: MenuItemConstructorOptions[] = [
    { label: state.copyId, click: () => act({ type: 'copy-id' }) },
    { label: state.copyPassword, click: () => act({ type: 'copy-password' }) },
  ];

  if (process.platform === 'darwin') app.dock?.setMenu(Menu.buildFromTemplate([...favorites, ...share]));

  if (!state.showIcon && !state.background) {
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
    tray.on('click', () => {
      // On macOS a click opens the menu; on Windows it brings up the window.
      if (process.platform !== 'darwin') show();
    });
  }
  tray.setToolTip(state.tooltip);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      ...(state.status ? [{ label: state.status, enabled: false }] : []),
      ...(state.disconnect ? [{ label: state.disconnect, click: () => act({ type: 'disconnect' }) }] : []),
      ...(state.status || state.disconnect ? [{ type: 'separator' as const }] : []),
      ...favorites,
      ...share,
      { type: 'separator' },
      { label: state.open, click: show },
      { label: state.quit, click: () => app.quit() },
    ]),
  );
}

// While running in the background, closing the window only hides it.
export function keepAliveOnClose(win: BrowserWindow) {
  win.on('close', (e) => {
    if (keepAlive && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}
