// Messages exchanged between host and viewer over Trystero actions.

export type Role = 'host' | 'viewer';

export type Hello = { role: Role; platform: string };

export type AnswerReason = 'declined' | 'busy' | 'capture';
export type Answer = { accepted: boolean; reason?: AnswerReason };

// Viewer -> host session settings.
export type Quality = 'auto' | 'speed' | 'quality';
export type Control = { quality: Quality };

// How much the host downscales the stream for each quality preset.
export const QUALITY_SCALE: Record<Quality, number> = { auto: 1, speed: 1.5, quality: 1 };

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
