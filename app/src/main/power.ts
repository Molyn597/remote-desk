import { powerSaveBlocker } from 'electron';
import { log } from './log';

// "Keep this computer awake": the system must not sleep, so it stays reachable while you are
// away. The screen may still turn off. While someone is connected, the screen stays on too,
// so the capture doesn't go black or lock mid-session.
let systemBlocker: number | undefined;
let sessionBlocker: number | undefined;

function toggle(current: number | undefined, on: boolean, type: 'prevent-app-suspension' | 'prevent-display-sleep') {
  if (on && current === undefined) return powerSaveBlocker.start(type);
  if (!on && current !== undefined) powerSaveBlocker.stop(current);
  return on ? current : undefined;
}

export function setKeepAwake(enabled: boolean) {
  if (enabled === (systemBlocker !== undefined)) return;
  systemBlocker = toggle(systemBlocker, enabled, 'prevent-app-suspension');
  log('info', 'power', enabled ? 'keeping the computer awake' : 'sleep allowed again');
}

export function setSessionAwake(active: boolean) {
  sessionBlocker = toggle(sessionBlocker, active, 'prevent-display-sleep');
}
