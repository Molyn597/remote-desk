export type Language = 'auto' | 'en' | 'cs';
export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  language: Language;
  theme: Theme;
  displayName: string;
  lastSeenVersion: string; // shows "What's new" once after an update
  serverUrl: string; // empty = public Nostr relays
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
}

export interface RecentPartner {
  id: string;
  lastConnected: number;
}

const SETTINGS_KEY = 'settings';
const RECENT_KEY = 'recentPartners';
const HOST_ID_KEY = 'hostId';
const MAX_RECENT = 20;

const DEFAULTS: Settings = {
  language: 'auto',
  theme: 'auto',
  displayName: '',
  lastSeenVersion: '',
  serverUrl: '',
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; settings stay in memory for this run
  }
}

export const loadSettings = (): Settings => ({ ...DEFAULTS, ...read<Partial<Settings>>(SETTINGS_KEY, {}) });
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s);

export const loadRecent = (): RecentPartner[] => read<RecentPartner[]>(RECENT_KEY, []);

export function addRecent(id: string) {
  const list = loadRecent().filter((p) => p.id !== id);
  list.unshift({ id, lastConnected: Date.now() });
  write(RECENT_KEY, list.slice(0, MAX_RECENT));
}

export function removeRecent(id: string) {
  write(RECENT_KEY, loadRecent().filter((p) => p.id !== id));
}

export function loadHostId(): string {
  let id = String(read<unknown>(HOST_ID_KEY, ''));
  if (!/^\d{9}$/.test(id)) {
    const [n] = crypto.getRandomValues(new Uint32Array(1));
    id = String(100_000_000 + (n % 900_000_000));
    write(HOST_ID_KEY, id);
  }
  return id;
}

// Devices that may connect without the Allow prompt (they still need the password).
export interface TrustedDevice {
  fingerprint: string;
  publicKey: string;
  name: string;
  id: string;
  control: boolean;
  added: number;
  lastUsed?: number;
}

const TRUSTED_KEY = 'trustedDevices';

export const loadTrusted = (): TrustedDevice[] => read<TrustedDevice[]>(TRUSTED_KEY, []);

export function addTrusted(device: TrustedDevice) {
  write(TRUSTED_KEY, [device, ...loadTrusted().filter((d) => d.fingerprint !== device.fingerprint)]);
}

export function removeTrusted(fingerprint: string) {
  write(TRUSTED_KEY, loadTrusted().filter((d) => d.fingerprint !== fingerprint));
}

export function touchTrusted(fingerprint: string) {
  write(TRUSTED_KEY, loadTrusted().map((d) => (d.fingerprint === fingerprint ? { ...d, lastUsed: Date.now() } : d)));
}
