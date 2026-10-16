import type { DisplayInfo, FileOffer, InputEvent } from '../../../shared/protocol';

export type SessionState = 'idle' | 'host' | 'viewer';
export type PermissionStatus = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown';
export type PermissionKind = 'screen' | 'accessibility';
export type ConfirmChoice = 'control' | 'view' | 'deny';
export type SessionAction = 'pause' | 'resume' | 'disconnect';

export interface TrayState {
  background: boolean;
  showIcon: boolean;
  tooltip: string;
  open: string;
  quit: string;
  favoritesTitle: string;
  copyId: string;
  copyPassword: string;
  status?: string;
  disconnect?: string;
  favorites: { id: string; label: string }[];
}

export type DeepLink = { action: 'connect'; id: string };

export type TrayAction = { type: 'connect'; id: string } | { type: 'copy-id' } | { type: 'copy-password' } | { type: 'disconnect' };

export interface ConfirmText {
  title: string;
  detail: string;
  allowControl: string;
  allowView: string;
  deny: string;
  // Shown as a checkbox when the visitor can be remembered as a trusted device.
  remember?: string;
}

export interface ConfirmResult {
  choice: ConfirmChoice;
  remember: boolean;
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
  // False when updates must be downloaded by hand (e.g. a macOS build without the release signature).
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
  confirmConnection(text: ConfirmText): Promise<ConfirmResult>;
  setSessionState(state: SessionState): void;
  sendInput(ev: InputEvent): void;
  // Host monitors: list them, pick the one the next capture records, and map the mouse to a view.
  getDisplays(): Promise<DisplayInfo[]>;
  setCaptureTarget(id: string): Promise<void>;
  setInputView(view: string): void;
  // Main window <-> session panel.
  showSessionPanel(info: SessionPanelInfo | null): void;
  onSessionAction(handler: (action: SessionAction) => void): void;
  // Session panel window.
  onSessionPanelInfo(handler: (info: SessionPanelInfo) => void): void;
  sendSessionAction(action: SessionAction): void;
  // Permissions, shared clipboard and received files.
  resetPermission(kind: PermissionKind): Promise<boolean>;
  watchClipboard(enabled: boolean): void;
  onClipboardChange(handler: (text: string) => void): void;
  writeClipboard(text: string): void;
  saveReceivedFile(name: string, data: ArrayBuffer): Promise<string | null>;
  onClipboardFiles(handler: (offers: FileOffer[]) => void): void;
  pickFilesToSend(title: string): Promise<FileOffer[]>;
  readOfferedFile(id: string): Promise<{ name: string; data: ArrayBuffer } | null>;
  setTheme(theme: 'light' | 'dark'): void;
  // Diagnostics log (main process writes the file; secrets and IDs are redacted there).
  log(level: 'info' | 'warn' | 'error', source: string, message: string): void;
  readLog(): Promise<string>;
  clearLog(): void;
  revealLog(): void;
  setKeepAwake(enabled: boolean): void;
  // Host: black out this computer's monitors (Windows), and hear when local mouse use lifted it.
  setPrivacyScreen(enabled: boolean, message: string): void;
  onPrivacyOff(handler: () => void): void;
  // Menu bar/tray icon and Dock menu, and whether the app keeps running in the background.
  setTrayState(state: TrayState): void;
  onTrayAction(handler: (action: TrayAction) => void): void;
  // remotedesk:// links; returns a link that opened the app before the window was ready.
  onDeepLink(handler: (link: DeepLink) => void): Promise<DeepLink | null>;
  revealFile(path: string): void;
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
