import { joinRoom as joinRelay, getRelaySockets as relaySockets } from '@trystero-p2p/ws-relay';
import type { JoinRoomCallbacks, Room } from '@trystero-p2p/ws-relay';
import { joinRoom as joinNostr, getRelaySockets as nostrSockets } from 'trystero';
import type { Settings } from './settings';

const APP_ID = 'remote-desk-v1';

// Public Nostr relays by default; a self-hosted ws-relay when a server URL is set.
export function join(settings: Settings, roomId: string, password: string, callbacks?: JoinRoomCallbacks): Room {
  const turnConfig = settings.turnUrl
    ? [{ urls: settings.turnUrl, username: settings.turnUsername, credential: settings.turnCredential }]
    : [];
  const config = { appId: APP_ID, password, turnConfig };
  return settings.serverUrl
    ? joinRelay({ ...config, relayConfig: { urls: [settings.serverUrl] } }, roomId, callbacks)
    : joinNostr(config, roomId, callbacks);
}

export function isOnline(settings: Settings): boolean {
  const sockets: Record<string, { socket?: WebSocket; readyState?: number }> =
    (settings.serverUrl ? relaySockets() : nostrSockets()) ?? {};
  return Object.values(sockets).some((s) => (s.socket ?? s).readyState === WebSocket.OPEN);
}
