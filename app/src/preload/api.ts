import type { InputEvent } from '../../../shared/protocol';

export type SessionState = 'idle' | 'host' | 'viewer';
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';
export type PermissionKind = 'screen' | 'accessibility';

export interface ConfirmText {
  title: string;
  detail: string;
  allow: string;
  deny: string;
}

export interface Api {
  getConfig(): Promise<{ platform: string; locale: string; version: string }>;
  getPermissions(): Promise<{ screen: PermissionStatus; accessibility: boolean }>;
  requestPermission(kind: PermissionKind): Promise<void>;
  relaunch(): void;
  copyText(text: string): void;
  confirmConnection(text: ConfirmText): Promise<boolean>;
  setSessionState(state: SessionState): void;
  sendInput(ev: InputEvent): void;
}
