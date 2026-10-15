import robot from '@jitsi/robotjs';
import type { InputEvent, MouseButton } from '../../../shared/protocol';

const BUTTONS = new Set<MouseButton>(['left', 'right', 'middle']);
const MODIFIERS = new Set(['shift', 'control', 'alt', 'command']);
const NAMED_KEYS = new Set([
  'backspace', 'delete', 'enter', 'tab', 'escape', 'space', 'insert',
  'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);
const CHAR_KEY = /^[a-z0-9`\-=[\]\\;',./]$/;

const pressed = new Set<MouseButton>();
let viewerPlatform = '';

robot.setMouseDelay(0);
robot.setKeyboardDelay(0);

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number(v) || 0));
const clampScroll = (v: number) => Math.max(-1000, Math.min(1000, Math.round(Number(v) || 0)));

// Cmd on macOS and Ctrl elsewhere play the same role in shortcuts (copy, paste, ...).
function remapModifiers(mods: string[]): string[] {
  const valid = (Array.isArray(mods) ? mods : []).filter((m) => MODIFIERS.has(m));
  const viewerPrimary = viewerPlatform === 'darwin' ? 'command' : 'control';
  const hostPrimary = process.platform === 'darwin' ? 'command' : 'control';
  if (viewerPrimary === hostPrimary) return valid;
  return valid.map((m) => (m === viewerPrimary ? hostPrimary : m === hostPrimary ? viewerPrimary : m));
}

export function handleInput(ev: InputEvent) {
  switch (ev.t) {
    case 'hello':
      viewerPlatform = String(ev.platform);
      return;
    case 'move': {
      const { width, height } = robot.getScreenSize();
      const x = Math.round(clamp01(ev.x) * (width - 1));
      const y = Math.round(clamp01(ev.y) * (height - 1));
      // macOS only recognises drags from drag events, not plain moves.
      if (pressed.size) robot.dragMouse(x, y);
      else robot.moveMouse(x, y);
      return;
    }
    case 'button':
      if (!BUTTONS.has(ev.button)) return;
      robot.mouseToggle(ev.down ? 'down' : 'up', ev.button);
      if (ev.down) pressed.add(ev.button);
      else pressed.delete(ev.button);
      return;
    case 'wheel':
      robot.scrollMouse(clampScroll(ev.dx), clampScroll(ev.dy));
      return;
    case 'text':
      if (typeof ev.text === 'string' && ev.text.length <= 32) robot.typeString(ev.text);
      return;
    case 'key':
      if (NAMED_KEYS.has(ev.key) || CHAR_KEY.test(ev.key)) robot.keyTap(ev.key, remapModifiers(ev.modifiers));
      return;
    case 'combo': {
      if (!NAMED_KEYS.has(ev.key) && !CHAR_KEY.test(ev.key) && !MODIFIERS.has(ev.key)) return;
      const mods = (Array.isArray(ev.modifiers) ? ev.modifiers : []).filter((m) => MODIFIERS.has(m));
      robot.keyTap(ev.key, mods);
      return;
    }
  }
}

export function resetInput() {
  for (const button of pressed) robot.mouseToggle('up', button);
  pressed.clear();
  viewerPlatform = '';
}
