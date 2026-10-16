import { screen, type Rectangle } from 'electron';
import { ALL_DISPLAYS, type DisplayInfo } from '../../../shared/protocol';

// Monitor rectangles in the coordinates robotjs moves the mouse in:
// points on macOS, physical pixels on Windows (where monitors may use different scaling).
function inputRect(bounds: Rectangle): Rectangle {
  return process.platform === 'win32' ? screen.dipToScreenRect(null, bounds) : bounds;
}

export function listDisplays(): DisplayInfo[] {
  const primary = screen.getPrimaryDisplay().id;
  return screen
    .getAllDisplays()
    .map((d) => ({ id: String(d.id), primary: d.id === primary, ...inputRect(d.bounds) }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
}

// The area the viewer's picture covers: one monitor, or all of them together.
export function viewRect(view: unknown): Rectangle {
  const displays = listDisplays();
  if (view === ALL_DISPLAYS && displays.length > 1) {
    const left = Math.min(...displays.map((d) => d.x));
    const top = Math.min(...displays.map((d) => d.y));
    const right = Math.max(...displays.map((d) => d.x + d.width));
    const bottom = Math.max(...displays.map((d) => d.y + d.height));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
  const { x, y, width, height } = displays.find((d) => d.id === view) ?? displays.find((d) => d.primary)!;
  return { x, y, width, height };
}
