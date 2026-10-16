import type { Room } from '@trystero-p2p/ws-relay';
import {
  MAX_CLIPBOARD_CHARS,
  MAX_FILE_BYTES,
  type Answer,
  type AnswerReason,
  type Challenge,
  type ClipboardData,
  type Control,
  type FileMeta,
  type Hello,
  type InputEvent,
  type Proof,
  type SessionStatus,
} from '../../../shared/protocol';
import { challengeText, type Identity } from './identity';
import { join } from './network';
import type { Settings } from './settings';

const FIND_TIMEOUT_MS = 30_000;
const ACCEPT_TIMEOUT_MS = 60_000;

export type ViewerError = AnswerReason | 'wrongPassword' | 'notFound' | 'noResponse' | 'partnerLeft';
export type ViewerStatus = 'searching' | 'waiting';

export interface ViewerSession {
  hostPlatform: string;
  // Size of the host's captured screen in pixels (the stream itself may be downscaled).
  screen?: { width: number; height: number };
  // False when the host granted view-only access or paused control.
  canControl: boolean;
  onControlChange?: (canControl: boolean) => void;
  sendInput(ev: InputEvent): void;
  sendControl(control: Control): void;
  // Shared clipboard; the toolbar can turn it off for this session.
  clipboardEnabled: boolean;
  shareClipboard(text: string): void;
  // Resolves to the result reported by the host after it saved the file.
  sendFile(file: File, onProgress: (fraction: number) => void): Promise<FileResult>;
  connection(): RTCPeerConnection | undefined;
}

export type FileResult = 'sent' | 'tooLarge' | 'rejected';

export interface ViewerEvents {
  onStatus(status: ViewerStatus): void;
  onConnected(session: ViewerSession): void;
  onStream(stream: MediaStream): void;
  onEnd(error?: ViewerError): void;
}

const validScreen = (s: unknown) => {
  const { width, height } = (s ?? {}) as { width?: unknown; height?: unknown };
  return typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0 && width < 20_000
    ? { width, height }
    : undefined;
};

// Joins the host's room, asks for access and receives its screen.
export class Viewer {
  private room?: Room;
  private hostPeer?: string;
  private hostPlatform = '';
  private timer?: number;
  private connected = false;
  private sendBye?: () => void;

  constructor(
    private readonly platform: string,
    private readonly events: ViewerEvents,
  ) {}

  connect(
    settings: Settings,
    partnerId: string,
    password: string,
    me: { name: string; id: string; identity?: Identity },
  ) {
    const room = join(settings, partnerId, password, {
      onJoinError: (e) => {
        if (/password/i.test(e.error)) this.end('wrongPassword');
      },
    });
    this.room = room;
    this.events.onStatus('searching');
    this.startTimer(FIND_TIMEOUT_MS, 'notFound');

    const hello = room.makeAction<Hello>('hello');
    const answer = room.makeAction<Answer>('answer');
    const bye = room.makeAction<null>('bye');
    const input = room.makeAction<InputEvent>('input');
    const control = room.makeAction<Control>('control');
    const status = room.makeAction<SessionStatus>('status');
    const challenge = room.makeAction<Challenge>('challenge');
    const proof = room.makeAction<Proof>('proof');
    const clip = room.makeAction<ClipboardData>('clip');
    const file = room.makeAction<ArrayBuffer>('file');
    const fileAck = room.makeAction<{ name: string; ok: boolean }>('fileack');
    const ackWaiters = new Map<string, (ok: boolean) => void>();
    let session: ViewerSession | undefined;

    clip.onMessage = (data, { peerId }) => {
      const text = data?.text;
      if (session?.clipboardEnabled && session.canControl && peerId === this.hostPeer && typeof text === 'string' && text.length <= MAX_CLIPBOARD_CHARS) {
        window.api.writeClipboard(text);
      }
    };
    fileAck.onMessage = (data, { peerId }) => {
      if (peerId !== this.hostPeer || typeof data?.name !== 'string') return;
      ackWaiters.get(data.name)?.(Boolean(data.ok));
    };

    // Only the host may get our signature; a challenge can arrive before its hello.
    const pendingChallenges = new Map<string, string>();
    const answerChallenge = async (peerId: string, nonce: string) => {
      if (!me.identity) return;
      const signature = await me.identity.sign(challengeText(partnerId, nonce));
      void proof.send({ signature }, { target: peerId });
    };
    challenge.onMessage = (data, { peerId }) => {
      if (typeof data?.nonce !== 'string' || data.nonce.length > 100) return;
      if (peerId === this.hostPeer) void answerChallenge(peerId, data.nonce);
      else pendingChallenges.set(peerId, data.nonce);
    };

    const myHello: Hello = { role: 'viewer', platform: this.platform, name: me.name, id: me.id, key: me.identity?.publicKey };
    room.onPeerJoin = (peerId) => void hello.send(myHello, { target: peerId });
    hello.onMessage = (data, { peerId }) => {
      if (data?.role !== 'host' || this.hostPeer) return;
      this.hostPeer = peerId;
      const nonce = pendingChallenges.get(peerId);
      if (nonce) void answerChallenge(peerId, nonce);
      pendingChallenges.clear();
      this.hostPlatform = String(data.platform);
      this.events.onStatus('waiting');
      this.startTimer(ACCEPT_TIMEOUT_MS, 'noResponse');
    };
    answer.onMessage = (data, { peerId }) => {
      if (peerId !== this.hostPeer || this.connected) return;
      if (!data?.accepted) {
        const known: AnswerReason[] = ['declined', 'busy', 'capture'];
        return this.end(known.includes(data?.reason as AnswerReason) ? data.reason : 'declined');
      }
      clearTimeout(this.timer);
      this.connected = true;
      session = {
        hostPlatform: this.hostPlatform,
        canControl: data.control !== false,
        screen: validScreen(data.screen),
        sendInput: (ev) => void input.send(ev, { target: peerId }),
        sendControl: (c) => void control.send(c, { target: peerId }),
        connection: () => this.room?.getPeers()[peerId],
        clipboardEnabled: true,
        shareClipboard: (text) => {
          if (session?.clipboardEnabled && session.canControl) void clip.send({ text }, { target: peerId });
        },
        sendFile: async (f, onProgress) => {
          if (f.size > MAX_FILE_BYTES) return 'tooLarge';
          const name = f.name.slice(0, 200);
          const acked = new Promise<boolean>((resolve) => ackWaiters.set(name, resolve));
          const meta: FileMeta = { name, size: f.size };
          try {
            await file.send(await f.arrayBuffer(), { target: peerId, metadata: meta, onProgress: (p) => onProgress(p) });
          } catch {
            ackWaiters.delete(name);
            return 'rejected';
          }
          const ok = await Promise.race([acked, new Promise<boolean>((r) => setTimeout(() => r(false), 30_000))]);
          ackWaiters.delete(name);
          return ok ? 'sent' : 'rejected';
        },
      };
      window.api.watchClipboard(true);
      this.events.onConnected(session);
    };
    status.onMessage = (data, { peerId }) => {
      if (!session || peerId !== this.hostPeer || typeof data?.control !== 'boolean') return;
      session.canControl = data.control;
      session.onControlChange?.(data.control);
    };
    room.onPeerStream = (stream, peerId) => {
      if (peerId !== this.hostPeer) return;
      // Play frames as soon as they arrive instead of buffering for smoothness.
      for (const receiver of this.room?.getPeers()[peerId]?.getReceivers() ?? []) {
        (receiver as RTCRtpReceiver & { jitterBufferTarget?: number }).jitterBufferTarget = 0;
      }
      this.events.onStream(stream);
    };
    bye.onMessage = (_, { peerId }) => {
      if (peerId === this.hostPeer) this.end('partnerLeft');
    };
    room.onPeerLeave = (peerId) => {
      if (peerId === this.hostPeer) this.end('partnerLeft');
    };
    this.sendBye = () => {
      if (this.hostPeer) void bye.send(null, { target: this.hostPeer });
    };
  }

  disconnect() {
    this.sendBye?.();
    this.end();
  }

  private startTimer(ms: number, error: ViewerError) {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.end(error), ms);
  }

  private end(error?: ViewerError) {
    if (!this.room) return;
    clearTimeout(this.timer);
    const room = this.room;
    this.room = undefined;
    this.hostPeer = undefined;
    this.connected = false;
    this.sendBye = undefined;
    void room.leave();
    this.events.onEnd(error);
  }
}
