import { appendFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { app } from 'electron';

export type LogLevel = 'info' | 'warn' | 'error';

// ~/Library/Logs/Remote Desk on macOS, %APPDATA%\Remote Desk\logs on Windows.
export const logFile = () => path.join(app.getPath('logs'), 'remote-desk.log');

const MAX_BYTES = 1_000_000;
const MAX_LINE = 600;
const LEVELS = new Set<LogLevel>(['info', 'warn', 'error']);

// The log is meant to be pasted into bug reports: partner IDs keep only their last digits
// and anything that looks like a key or token is dropped.
export function redact(text: string): string {
  return text
    .replace(/\b\d{3}[ -]?\d{3}[ -]?(\d{3})\b/g, '••• ••• $1')
    .replace(/[A-Za-z0-9+/_-]{32,}={0,2}/g, '[redacted]');
}

function clean(message: unknown): string {
  return redact(String(message ?? ''))
    .replace(/[\p{C}]+/gu, ' ')
    .trim()
    .slice(0, MAX_LINE);
}

const stamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Keeps the newest half once the file grows past the limit.
function rotate(file: string) {
  try {
    if (statSync(file).size <= MAX_BYTES) return;
    const text = readFileSync(file, 'utf8');
    const rest = text.slice(text.length - MAX_BYTES / 2);
    writeFileSync(file, rest.slice(rest.indexOf('\n') + 1));
  } catch {
    // no file yet
  }
}

let lastEntry = '';
let repeats = 0;

export function log(level: LogLevel, source: string, message: unknown) {
  if (!LEVELS.has(level)) return;
  // A failing action repeated many times (e.g. every mouse move) is written once.
  const entry = `${level.toUpperCase().padEnd(5)} [${clean(source).slice(0, 12)}] ${clean(message)}`;
  if (entry === lastEntry) {
    repeats++;
    return;
  }
  let line = `${stamp()} ${entry}\n`;
  if (repeats) line = `${stamp()} INFO  [log] previous message repeated ${repeats} more times\n${line}`;
  lastEntry = entry;
  repeats = 0;
  if (!app.isPackaged) process.stdout.write(line);
  try {
    const file = logFile();
    mkdirSync(path.dirname(file), { recursive: true });
    rotate(file);
    appendFileSync(file, line);
  } catch {
    // logging must never break the app
  }
}

export const errorText = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

export function readLog(maxLines = 400): string {
  try {
    const lines = readFileSync(logFile(), 'utf8').trimEnd().split('\n');
    return lines.slice(-maxLines).join('\n');
  } catch {
    return '';
  }
}

export function clearLog() {
  try {
    writeFileSync(logFile(), '');
  } catch {
    // nothing to clear
  }
}

export function logStartup() {
  log('info', 'main', `Remote Desk ${app.getVersion()} on ${process.platform} ${os.release()} (${process.arch}), Electron ${process.versions.electron}, language ${app.getPreferredSystemLanguages()[0] ?? app.getLocale()}`);
  process.on('unhandledRejection', (reason) => log('error', 'main', `unhandled rejection: ${errorText(reason)}`));
}
