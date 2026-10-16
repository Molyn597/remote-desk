import robot from '@jitsi/robotjs';
import type { Rectangle } from 'electron';
import type { InputEvent, MouseButton } from '../../../shared/protocol';

const BUTTONS = new Set<MouseButton>(['left', 'right', 'middle']);
const MODIFIERS = new Set(['shift', 'control', 'alt', 'command']);
const NAMED_KEYS = new Set([
  'backspace', 'delete', 'enter', 'tab', 'escape', 'space', 'insert',
  'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown',
  ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);
const CHAR_KEY = /^[a-z0-9`\-=[\]\\;',./]$/;

const LOCAL_PRIORITY_MS = 1500;
const LOCAL_POLL_MS = 100;

const pressed = new Set<MouseButton>();
let viewerPlatform = '';
let lastInjected: { x: number; y: number; at: number } | undefined;
let localUntil = 0;
let watchTimer: ReturnType<typeof setInterval> | undefined;
// The part of the desktop the viewer sees; mouse positions are relative to it.
let view: Rectangle | undefined;

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

// The person at this computer wins: moving the local mouse pauses remote input briefly.
export function watchLocalMouse(enabled: boolean) {
  clearInterval(watchTimer);
  watchTimer = undefined;
  lastInjected = undefined;
  localUntil = 0;
  if (!enabled) return;
  let last = robot.getMousePos();
  watchTimer = setInterval(() => {
    const pos = robot.getMousePos();
    const moved = Math.abs(pos.x - last.x) + Math.abs(pos.y - last.y) > 2;
    last = pos;
    if (!moved) return;
    const remote =
      lastInjected &&
      Date.now() - lastInjected.at < 250 &&
      Math.abs(pos.x - lastInjected.x) + Math.abs(pos.y - lastInjected.y) <= 2;
    if (!remote) {
      localUntil = Date.now() + LOCAL_PRIORITY_MS;
      releaseButtons();
    }
  }, LOCAL_POLL_MS);
}

function releaseButtons() {
  for (const button of pressed) robot.mouseToggle('up', button);
  pressed.clear();
}

export function handleInput(ev: InputEvent) {
  if (ev.t !== 'hello' && Date.now() < localUntil) return;
  switch (ev.t) {
    case 'hello':
      viewerPlatform = String(ev.platform);
      return;
    case 'move': {
      const area = view ?? { x: 0, y: 0, ...robot.getScreenSize() };
      const x = area.x + Math.round(clamp01(ev.x) * (area.width - 1));
      const y = area.y + Math.round(clamp01(ev.y) * (area.height - 1));
      // macOS only recognises drags from drag events, not plain moves.
      if (pressed.size) robot.dragMouse(x, y);
      else robot.moveMouse(x, y);
      lastInjected = { x, y, at: Date.now() };
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

export function setInputView(rect: Rectangle | undefined) {
  view = rect;
  if (process.platform === 'win32') robot.updateScreenMetrics(); // monitors may have changed
}

export function resetInput() {
  releaseButtons();
  viewerPlatform = '';
  view = undefined;
}
