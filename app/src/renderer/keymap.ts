import type { InputEvent } from '../../../shared/protocol';

const NAMED: Record<string, string> = {
  Backspace: 'backspace',
  Delete: 'delete',
  Enter: 'enter',
  NumpadEnter: 'enter',
  Tab: 'tab',
  Escape: 'escape',
  Space: 'space',
  Insert: 'insert',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

// Physical key (layout independent) -> robotjs key name.
function keyName(code: string): string | undefined {
  if (code in NAMED) return NAMED[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(code)) return code.toLowerCase();
}

// Plain typing is sent as text so the host types the same characters regardless
// of keyboard layouts; shortcuts and special keys are sent as key taps.
export function keyToInput(e: KeyboardEvent, isMac: boolean): InputEvent | null {
  const altGr = e.getModifierState('AltGraph');
  const printable = [...e.key].length === 1 && e.key !== ' ';
  if (printable && !e.metaKey && (altGr || (!e.ctrlKey && (!e.altKey || isMac)))) {
    return { t: 'text', text: e.key };
  }
  const key = keyName(e.code);
  if (!key) return null;
  const modifiers: string[] = [];
  if (e.shiftKey) modifiers.push('shift');
  if (e.ctrlKey && !altGr) modifiers.push('control');
  if (e.altKey && !altGr) modifiers.push('alt');
  if (e.metaKey) modifiers.push('command');
  return { t: 'key', key, modifiers };
}
