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

// Viewer -> host session settings.
export type Quality = 'auto' | 'speed' | 'quality';
export type Control = { quality: Quality };

export const MAX_NAME_LENGTH = 40;

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
