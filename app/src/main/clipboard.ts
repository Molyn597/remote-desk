import { fileURLToPath } from 'node:url';
import { clipboard } from 'electron';
import { MAX_CLIPBOARD_CHARS } from '../../../shared/protocol';

const POLL_MS = 500;
const WINDOWS_FILE_FORMAT = 'electron application/osclipboard;format="FileNameW"';

let timer: ReturnType<typeof setInterval> | undefined;
let lastText = '';
let lastFiles = '';
let generation = 0;

// Files copied in Finder/Explorer: a text/uri-list of file:// URLs (both platforms),
// with the raw Windows FileNameW format as a fallback.
export async function readClipboardFiles(): Promise<string[]> {
  try {
    for (const item of await clipboard.read()) {
      if (item.types.includes('text/uri-list')) {
        const list = await ((await item.getType('text/uri-list')) as Blob).text();
        const files = list
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.startsWith('file://'))
          .map((url) => fileURLToPath(url));
        if (files.length) return files;
      }
      if (item.types.includes(WINDOWS_FILE_FORMAT)) {
        const buffer = await ((await item.getType(WINDOWS_FILE_FORMAT)) as Blob).arrayBuffer();
        const file = Buffer.from(buffer).toString('utf16le').split('\0')[0];
        if (file) return [file];
      }
    }
  } catch {
    // clipboard formats we can't read
  }
  return [];
}

// Polls the system clipboard during a session and reports new text or copied files.
// Text we wrote ourselves (from the partner) is not reported back, so nothing echoes.
export async function watchClipboard(
  enabled: boolean,
  onText: (text: string) => void,
  onFiles: (paths: string[]) => void,
) {
  clearInterval(timer);
  timer = undefined;
  const current = ++generation;
  if (!enabled) return;
  lastText = await clipboard.readText();
  lastFiles = (await readClipboardFiles()).join('\n');
  if (current !== generation) return;
  timer = setInterval(async () => {
    const [text, files] = await Promise.all([clipboard.readText(), readClipboardFiles()]);
    if (current !== generation) return;
    const fileKey = files.join('\n');
    if (fileKey !== lastFiles) {
      lastFiles = fileKey;
      lastText = text; // a copied file also puts its name on the clipboard as text
      if (files.length) onFiles(files);
      return;
    }
    if (text === lastText) return;
    lastText = text;
    if (text && text.length <= MAX_CLIPBOARD_CHARS) onText(text);
  }, POLL_MS);
}

export async function writeClipboard(text: unknown) {
  if (typeof text !== 'string' || !text || text.length > MAX_CLIPBOARD_CHARS) return;
  lastText = text;
  await clipboard.writeText(text);
}
