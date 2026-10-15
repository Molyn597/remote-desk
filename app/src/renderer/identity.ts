// Per-install device key used to recognise trusted devices. The private key is
// stored as a non-extractable CryptoKey in IndexedDB, so it can sign but never
// be read out; the public key (SPKI, base64) is what other computers remember.

const DB_NAME = 'remote-desk';
const STORE = 'identity';
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGNATURE = { name: 'ECDSA', hash: 'SHA-256' } as const;

export interface Identity {
  publicKey: string;
  fingerprint: string;
  sign(message: string): Promise<string>;
}

const toBase64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const encode = (text: string) => new TextEncoder().encode(text);

export async function fingerprint(publicKey: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', fromBase64(publicKey));
  return Array.from(new Uint8Array(hash).slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
}

// The signed text names its purpose and the host, so a proof can't be replayed elsewhere.
export const challengeText = (hostId: string, nonce: string) => `remote-desk-trust:${hostId}:${nonce}`;

export async function verify(publicKey: string, message: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey('spki', fromBase64(publicKey), ALGORITHM, false, ['verify']);
    return await crypto.subtle.verify(SIGNATURE, key, fromBase64(signature), encode(message));
  } catch {
    return false;
  }
}

export function newNonce(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb<T>(db: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function loadIdentity(): Promise<Identity | undefined> {
  try {
    const db = await openDb();
    let record = await idb<{ privateKey: CryptoKey; publicKey: string } | undefined>(db, 'readonly', (s) =>
      s.get('device'),
    );
    if (!record) {
      const pair = await crypto.subtle.generateKey(ALGORITHM, false, ['sign', 'verify']);
      record = { privateKey: pair.privateKey, publicKey: toBase64(await crypto.subtle.exportKey('spki', pair.publicKey)) };
      await idb(db, 'readwrite', (s) => s.put(record, 'device'));
    }
    const { privateKey, publicKey } = record;
    return {
      publicKey,
      fingerprint: await fingerprint(publicKey),
      sign: async (message) => toBase64(await crypto.subtle.sign(SIGNATURE, privateKey, encode(message))),
    };
  } catch (err) {
    // Without a key the app still works; it just can't be remembered as trusted.
    console.error('device identity unavailable', err);
    return undefined;
  }
}
