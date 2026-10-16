import { BrowserWindow, screen } from 'electron';
import { log } from './log';

// Privacy screen: black windows over every monitor that screen capture leaves out
// (Windows 10 2004+ excludes content-protected windows), so the person controlling this
// computer from elsewhere sees the desktop while the monitors here stay dark.
// Clicks and keys go through to the windows underneath. The session panel (who is connected,
// Pause, Disconnect) stays above the black screen, so the person here can always end it.
let overlays: BrowserWindow[] = [];

const page = (message: string) =>
  'data:text/html;charset=utf-8,' +
  encodeURIComponent(`<!doctype html><html><body style="margin:0;height:100vh;display:grid;place-items:center;
background:#000;color:#8a8d91;font:15px -apple-system,'Segoe UI',sans-serif;text-align:center;cursor:none">
<p style="max-width:520px;line-height:1.6">${message.replace(/[<>&]/g, '')}</p></body></html>`);

export const privacyOn = () => overlays.length > 0;

export function setPrivacyScreen(enabled: boolean, message = '', keepAbove?: BrowserWindow) {
  if (!enabled) {
    if (!overlays.length) return;
    overlays.forEach((w) => w.destroy());
    overlays = [];
    log('info', 'privacy', 'screen shown again');
    return;
  }
  if (overlays.length || process.platform !== 'win32') return;
  overlays = screen.getAllDisplays().map((display) => {
    const w = new BrowserWindow({
      ...display.bounds,
      frame: false,
      show: false,
      focusable: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      backgroundColor: '#000000',
      webPreferences: { sandbox: true, javascript: false },
    });
    w.setContentProtection(true);
    w.setIgnoreMouseEvents(true);
    w.setAlwaysOnTop(true, 'screen-saver');
    void w.loadURL(page(message));
    w.once('ready-to-show', () => {
      w.showInactive();
      // Topmost windows stack in the order they were raised: put the panel back on top.
      if (keepAbove && !keepAbove.isDestroyed()) keepAbove.moveTop();
    });
    return w;
  });
  log('info', 'privacy', `screen hidden on ${overlays.length} monitor(s)`);
}
