import type { InputEvent, MouseButton } from '../../../shared/protocol';
import { keyToInput } from './keymap';

const BUTTONS: Record<number, MouseButton> = { 0: 'left', 1: 'middle', 2: 'right' };
const LINE_HEIGHT = 40;
// Trackpad gestures: a pinch arrives as ctrl+wheel; a fast sideways two-finger flick means back/forward.
const PINCH_STEP = 14;
const FLICK_DISTANCE = 260;
const FLICK_TIME_MS = 380;
const GESTURE_GAP_MS = 220;

const combo = (key: string, ...modifiers: string[]): InputEvent => ({ t: 'combo', key, modifiers });

// Captures mouse and keyboard over the remote video and returns a detach function.
export function attachInputCapture(
  video: HTMLVideoElement,
  send: (ev: InputEvent) => void,
  isMac: boolean,
  hostIsMac = false,
): () => void {
  let pending: { x: number; y: number } | null = null;
  let frame = 0;
  const held = new Set<MouseButton>();

  // Position within the actual picture, excluding letterbox bars (object-fit: contain).
  const normalize = (e: MouseEvent) => {
    const rect = video.getBoundingClientRect();
    const { videoWidth: vw, videoHeight: vh } = video;
    if (!vw || !vh) return null;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const w = vw * scale;
    const h = vh * scale;
    const x = (e.clientX - rect.left - (rect.width - w) / 2) / w;
    const y = (e.clientY - rect.top - (rect.height - h) / 2) / h;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
  };

  const flushMove = () => {
    frame = 0;
    if (pending) send({ t: 'move', ...pending });
    pending = null;
  };

  const onMove = (e: MouseEvent) => {
    const pos = normalize(e);
    if (!pos) return;
    pending = pos;
    frame ||= requestAnimationFrame(flushMove);
  };

  const onButton = (e: MouseEvent) => {
    const button = BUTTONS[e.button];
    if (!button) return;
    const down = e.type === 'mousedown';
    const pos = normalize(e);
    if (down) {
      if (!pos) return;
      held.add(button);
      video.focus();
    } else if (!held.delete(button)) {
      return;
    }
    e.preventDefault();
    if (pos) {
      pending = pos;
      flushMove();
    }
    send({ t: 'button', button, down });
  };

  let pinch = 0;
  let gesture = { start: 0, last: 0, x: 0, y: 0, fired: false };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_HEIGHT : 1;
    // Pinch (or Ctrl+scroll): zoom in the remote app, in steps.
    if (e.ctrlKey) {
      pinch += -e.deltaY * factor;
      while (Math.abs(pinch) >= PINCH_STEP) {
        const zoomIn = pinch > 0;
        pinch -= Math.sign(pinch) * PINCH_STEP;
        if (hostIsMac) send(combo(zoomIn ? '=' : '-', 'command'));
        else send({ t: 'wheel', dx: 0, dy: zoomIn ? 120 : -120, zoom: true });
      }
      return;
    }
    // A fast, mostly sideways two-finger flick is Back / Forward, once per gesture.
    const now = performance.now();
    if (now - gesture.last > GESTURE_GAP_MS) gesture = { start: now, last: now, x: 0, y: 0, fired: false };
    gesture.last = now;
    gesture.x += e.deltaX * factor;
    gesture.y += e.deltaY * factor;
    if (!gesture.fired && now - gesture.start < FLICK_TIME_MS && Math.abs(gesture.x) > FLICK_DISTANCE && Math.abs(gesture.x) > Math.abs(gesture.y) * 3) {
      gesture.fired = true;
      const back = gesture.x < 0; // fingers moved right
      if (hostIsMac) send(combo(back ? '[' : ']', 'command'));
      else send(combo(back ? 'left' : 'right', 'alt'));
      return;
    }
    if (gesture.fired && Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    send({ t: 'wheel', dx: -e.deltaX * factor, dy: -e.deltaY * factor });
  };

  const onKey = (e: KeyboardEvent) => {
    if (document.activeElement !== video) return;
    e.preventDefault();
    if (e.type !== 'keydown') return;
    const ev = keyToInput(e, isMac);
    if (ev) send(ev);
  };

  const onContextMenu = (e: Event) => e.preventDefault();

  video.addEventListener('mousemove', onMove);
  video.addEventListener('mousedown', onButton);
  window.addEventListener('mouseup', onButton);
  video.addEventListener('wheel', onWheel, { passive: false });
  video.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  return () => {
    cancelAnimationFrame(frame);
    video.removeEventListener('mousemove', onMove);
    video.removeEventListener('mousedown', onButton);
    window.removeEventListener('mouseup', onButton);
    video.removeEventListener('wheel', onWheel);
    video.removeEventListener('contextmenu', onContextMenu);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
  };
}
