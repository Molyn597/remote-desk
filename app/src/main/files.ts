import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { MAX_FILE_BYTES } from '../../../shared/protocol';

const saved = new Set<string>();

// Keeps only a plain file name: no folders, no hidden or reserved names.
function safeName(name: unknown): string {
  const base = path.basename(String(name ?? '')).replace(/[\\/:*?"<>|\p{C}]/gu, '_').replace(/^[.\s]+/, '').trim();
  return (base || 'file').slice(0, 120);
}

// Saves a file received from the partner into Downloads without overwriting anything.
export async function saveReceivedFile(name: unknown, data: unknown): Promise<string | null> {
  if (!(data instanceof ArrayBuffer) || data.byteLength > MAX_FILE_BYTES) return null;
  const dir = app.getPath('downloads');
  await mkdir(dir, { recursive: true });
  const file = safeName(name);
  const ext = path.extname(file);
  const stem = file.slice(0, file.length - ext.length);
  for (let i = 0; i < 1000; i++) {
    const target = path.join(dir, i === 0 ? file : `${stem} (${i})${ext}`);
    try {
      const handle = await open(target, 'wx'); // fails if the file exists
      await handle.writeFile(Buffer.from(data));
      await handle.close();
      saved.add(target);
      return target;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    }
  }
  return null;
}

// Only files this app saved can be revealed in Finder/Explorer.
export const wasSaved = (target: unknown) => typeof target === 'string' && saved.has(target);
