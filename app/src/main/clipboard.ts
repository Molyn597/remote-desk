import { clipboard } from 'electron';
import { MAX_CLIPBOARD_CHARS } from '../../../shared/protocol';

const POLL_MS = 500;

let timer: ReturnType<typeof setInterval> | undefined;
let last = '';
let generation = 0;

// Polls the system clipboard during a session and reports new text. Text we
// wrote ourselves (from the partner) is not reported back, so nothing echoes.
export async function watchClipboard(enabled: boolean, onChange: (text: string) => void) {
  clearInterval(timer);
  timer = undefined;
  const current = ++generation;
  if (!enabled) return;
  last = await clipboard.readText();
  if (current !== generation) return;
  timer = setInterval(async () => {
    const text = await clipboard.readText();
    if (current !== generation || text === last) return;
    last = text;
    if (text && text.length <= MAX_CLIPBOARD_CHARS) onChange(text);
  }, POLL_MS);
}

export async function writeClipboard(text: unknown) {
  if (typeof text !== 'string' || !text || text.length > MAX_CLIPBOARD_CHARS) return;
  last = text;
  await clipboard.writeText(text);
}
