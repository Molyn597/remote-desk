import type { InputEvent } from '../../../shared/protocol';

export type SessionState = 'idle' | 'host' | 'viewer';
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';
export type PermissionKind = 'screen' | 'accessibility';
export type ConfirmChoice = 'control' | 'view' | 'deny';
export type SessionAction = 'pause' | 'resume' | 'disconnect';

export interface ConfirmText {
  title: string;
  detail: string;
  allowControl: string;
  allowView: string;
  deny: string;
}

// Shown in the always-on-top session panel while this computer is being viewed.
export interface SessionPanelInfo {
  title: string;
  mode: string;
  startedAt: number;
  canControl: boolean;
  paused: boolean;
  pauseLabel: string;
  resumeLabel: string;
  disconnectLabel: string;
}

export interface UpdateState {
  status: 'unsupported' | 'idle' | 'checking' | 'latest' | 'available' | 'downloading' | 'ready' | 'error';
  // Windows downloads and installs updates; elsewhere the user downloads them.
  canInstall: boolean;
  version?: string;
  error?: string;
}

export interface Api {
  getConfig(): Promise<{ platform: string; locale: string; version: string }>;
  getPermissions(): Promise<{ screen: PermissionStatus; accessibility: boolean }>;
  requestPermission(kind: PermissionKind): Promise<void>;
  relaunch(): void;
  copyText(text: string): void;
  confirmConnection(text: ConfirmText): Promise<ConfirmChoice>;
  setSessionState(state: SessionState): void;
  sendInput(ev: InputEvent): void;
  // Main window <-> session panel.
  showSessionPanel(info: SessionPanelInfo | null): void;
  onSessionAction(handler: (action: SessionAction) => void): void;
  // Session panel window.
  onSessionPanelInfo(handler: (info: SessionPanelInfo) => void): void;
  sendSessionAction(action: SessionAction): void;
  // What's new and feedback.
  getChangelog(): Promise<string>;
  getRemoteChangelog(version: string): Promise<string | null>;
  openFeedback(kind: 'bug' | 'idea'): void;
  // Updates.
  getUpdateState(): Promise<UpdateState>;
  onUpdateState(handler: (state: UpdateState) => void): void;
  checkForUpdates(): void;
  installUpdate(): void;
  openDownloadPage(): void;
}
