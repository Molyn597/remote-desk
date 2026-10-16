import { execFile } from 'node:child_process';
import robot from '@jitsi/robotjs';
import type { PowerAction } from '../../../shared/protocol';
import { errorText, log } from './log';

const run = (file: string, args: string[]) =>
  execFile(file, args, (err) => {
    if (err) log('error', 'power', `${file} failed: ${errorText(err)}`);
  });

// Lock, sleep, restart or shut down this computer on request of the person controlling it.
// Restart and shutdown wait a few seconds, which gives the session time to close cleanly.
export function runPowerAction(action: PowerAction) {
  log('info', 'power', `remote request: ${action}`);
  if (process.platform === 'win32') {
    if (action === 'lock') run('rundll32.exe', ['user32.dll,LockWorkStation']);
    if (action === 'sleep')
      run('powershell.exe', ['-NoProfile', '-Command', "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"]);
    if (action === 'restart') run('shutdown.exe', ['/r', '/t', '5']);
    if (action === 'shutdown') run('shutdown.exe', ['/s', '/t', '5']);
    return;
  }
  if (process.platform === 'darwin') {
    if (action === 'lock') robot.keyTap('q', ['control', 'command']); // Lock Screen shortcut
    if (action === 'sleep') run('/usr/bin/pmset', ['sleepnow']);
    if (action === 'restart') run('/usr/bin/osascript', ['-e', 'tell application "System Events" to restart']);
    if (action === 'shutdown') run('/usr/bin/osascript', ['-e', 'tell application "System Events" to shut down']);
  }
}
