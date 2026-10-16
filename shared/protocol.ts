// Messages exchanged between host and viewer over Trystero actions.

export type Role = 'host' | 'viewer';

// The viewer also sends its display name, own ID and device public key (SPKI, base64)
// so the host knows who is asking and can recognise trusted devices.
export type Hello = { role: Role; platform: string; name?: string; id?: string; key?: string };

// Host -> viewer: sign this nonce to prove you own the device key. Viewer -> host: the signature.
export type Challenge = { nonce: string };
export type Proof = { signature: string };

// 'untrusted': a device that is no longer trusted tried the trusted-device room.
export type AnswerReason = 'declined' | 'busy' | 'capture' | 'untrusted';
// `control: false` means the host granted view-only access. `screen` is the captured size in pixels.
export type Answer = {
  accepted: boolean;
  reason?: AnswerReason;
  control?: boolean;
  // The viewer may black out the host's monitors (favorite, allowed by the host, Windows).
  privacy?: boolean;
  screen?: { width: number; height: number };
};

// Host -> viewer: whether remote input is currently accepted (view-only or paused by the host).
// `privacy`: this computer's monitors are blacked out (privacy screen) right now.
export type SessionStatus = { control: boolean; privacy?: boolean };

// Viewer -> host session settings: stream quality and which monitor to show.
// 'saver' keeps 1920 px but limits frame rate and data, e.g. on mobile data.
export type Quality = 'auto' | 'speed' | 'quality' | 'saver';
export type Control = { quality?: Quality; view?: string; privacy?: boolean };

// Host monitors, positioned as arranged in the host's display settings.
export type DisplayInfo = { id: string; primary: boolean; x: number; y: number; width: number; height: number };
// The view is a monitor ID or ALL_DISPLAYS (every monitor in one picture).
export const ALL_DISPLAYS = 'all';
// Host -> viewer: its monitors, what is shown now and the picture size in pixels.
export type DisplayLayout = { displays: DisplayInfo[]; view: string; screen: { width: number; height: number } };

export const MAX_NAME_LENGTH = 40;

// Trusted devices connect without the password through a second room of the host,
// encrypted with a secret the host hands out when it remembers the device.
export const trustedRoom = (hostId: string) => `${hostId}:trusted`;
export type Pairing = { secret: string };
// Viewer -> host during a session: please add me to favorites (connect without a password).
// Host -> viewer: the answer; an accepted request is followed by the room key ('pair').
export type FavoriteRequest = { add: true };
export type FavoriteAnswer = { accepted: boolean };

// Viewer -> host: power actions on the controlled computer (only while control is allowed).
export type PowerAction = 'lock' | 'sleep' | 'restart' | 'shutdown';
export const POWER_ACTIONS: PowerAction[] = ['lock', 'sleep', 'restart', 'shutdown'];
export type PowerRequest = { action: PowerAction };
export const isTrustSecret = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v);

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
  // `zoom`: Ctrl+scroll on the host (pinch-to-zoom on the viewer's trackpad).
  | { t: 'wheel'; dx: number; dy: number; zoom?: boolean }
  | { t: 'text'; text: string }
  | { t: 'key'; key: string; modifiers: string[] }
  // Shortcut chosen from the toolbar, already in the host's terms (no Cmd/Ctrl swap).
  | { t: 'combo'; key: string; modifiers: string[] };
