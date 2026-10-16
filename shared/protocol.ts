// Messages exchanged between host and viewer over Trystero actions.

export type Role = 'host' | 'viewer';

// The viewer also sends its display name, own ID and device public key (SPKI, base64)
// so the host knows who is asking and can recognise trusted devices.
export type Hello = { role: Role; platform: string; name?: string; id?: string; key?: string };

// Host -> viewer: sign this nonce to prove you own the device key. Viewer -> host: the signature.
export type Challenge = { nonce: string };
export type Proof = { signature: string };

export type AnswerReason = 'declined' | 'busy' | 'capture';
// `control: false` means the host granted view-only access. `screen` is the captured size in pixels.
export type Answer = {
  accepted: boolean;
  reason?: AnswerReason;
  control?: boolean;
  screen?: { width: number; height: number };
};

// Host -> viewer: whether remote input is currently accepted (view-only or paused by the host).
export type SessionStatus = { control: boolean };

// Viewer -> host session settings: stream quality and which monitor to show.
export type Quality = 'auto' | 'speed' | 'quality';
export type Control = { quality?: Quality; view?: string };

// Host monitors, positioned as arranged in the host's display settings.
export type DisplayInfo = { id: string; primary: boolean; x: number; y: number; width: number; height: number };
// The view is a monitor ID or ALL_DISPLAYS (every monitor in one picture).
export const ALL_DISPLAYS = 'all';
// Host -> viewer: its monitors, what is shown now and the picture size in pixels.
export type DisplayLayout = { displays: DisplayInfo[]; view: string; screen: { width: number; height: number } };

export const MAX_NAME_LENGTH = 40;

// Shared clipboard (text only), sent both ways while remote control is allowed.
export type ClipboardData = { text: string };
export const MAX_CLIPBOARD_CHARS = 100_000;

// File transfer in both directions: the file is the binary payload, this is its metadata.
export type FileMeta = { name: string; size: number };
export const MAX_FILE_BYTES = 500 * 1024 * 1024;

// Host -> viewer: files copied (Ctrl/Cmd+C) or picked on the host, ready to download.
export type FileOffer = { id: string; name: string; size: number };
// Viewer -> host: send these offered files, or open a file picker on the host.
export type FileRequest = { ids?: string[]; pick?: boolean };

// Viewer -> host input. Coordinates are normalized to 0..1 of the host's primary display.

export type MouseButton = 'left' | 'right' | 'middle';

export type InputEvent =
  | { t: 'hello'; platform: string }
  | { t: 'move'; x: number; y: number }
  | { t: 'button'; button: MouseButton; down: boolean }
  | { t: 'wheel'; dx: number; dy: number }
  | { t: 'text'; text: string }
  | { t: 'key'; key: string; modifiers: string[] }
  // Shortcut chosen from the toolbar, already in the host's terms (no Cmd/Ctrl swap).
  | { t: 'combo'; key: string; modifiers: string[] };
