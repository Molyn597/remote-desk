import type { Room } from '@trystero-p2p/ws-relay';
import {
  MAX_CLIPBOARD_CHARS,
  MAX_FILE_BYTES,
  MAX_NAME_LENGTH,
  type Answer,
  type Challenge,
  type ClipboardData,
  type Control,
  type FileMeta,
  type Hello,
  type InputEvent,
  type Proof,
  type Quality,
  type SessionStatus,
} from '../../../shared/protocol';
import type { ConfirmChoice } from '../preload/api';
import { challengeText, fingerprint, newNonce, verify } from './identity';
import { join } from './network';
import { addTrusted, loadTrusted, touchTrusted, type Settings } from './settings';

// Encoding a full Retina/4K screen is slow; "auto" and "speed" downscale it for low latency.
const QUALITY_PRESETS: Record<
  Quality,
  { bitrate: number; maxWidth: number; fps: number; preference: RTCDegradationPreference; hint: string }
> = {
  auto: { bitrate: 10_000_000, maxWidth: 1920, fps: 60, preference: 'maintain-framerate', hint: 'motion' },
  speed: { bitrate: 4_000_000, maxWidth: 1280, fps: 60, preference: 'maintain-framerate', hint: 'motion' },
  quality: { bitrate: 20_000_000, maxWidth: Infinity, fps: 30, preference: 'maintain-resolution', hint: 'detail' },
};

// After a refusal the same peer can't pop up another dialog for a while.
const DECLINE_COOLDOWN_MS = 20_000;
const PROOF_TIMEOUT_MS = 10_000;

export interface Visitor {
  name: string;
  id: string;
  // Device public key; present when the viewer can be remembered as trusted.
  key?: string;
}

export interface HostSession extends Visitor {
  canControl: boolean;
  paused: boolean;
  startedAt: number;
  trusted: boolean;
}

export interface HostEvents {
  confirm(visitor: Visitor): Promise<{ choice: ConfirmChoice; remember: boolean }>;
  onSessionChange(session: HostSession | null, error?: 'capture' | 'partnerLeft'): void;
  onFileReceived(name: string, path: string | null): void;
}

const cleanName = (value: unknown) =>
  String(value ?? '')
    .replace(/[\p{C}]/gu, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

const cleanId = (value: unknown) => (/^\d{9}$/.test(String(value)) ? String(value) : '');

const cleanKey = (value: unknown) =>
  typeof value === 'string' && value.length < 300 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;

// Waits in the room named after this computer's ID and serves one viewer at a time.
export class Host {
  private room?: Room;
  private session?: HostSession & { peerId: string };
  private pendingPeer?: string;
  private stream?: MediaStream;
  private declined = new Map<string, number>();
  private hostId = '';
  private proofWaiters = new Map<string, (signature: string) => void>();
  private sendChallenge?: (data: Challenge, peerId: string) => void;
  private sendClip?: (data: ClipboardData, peerId: string) => void;
  private sendHello?: (data: Hello, peerId: string) => void;
  private sendAnswer?: (data: Answer, peerId: string) => void;
  private sendStatus?: (data: SessionStatus, peerId: string) => void;
  private sendBye?: (peerId: string) => void;

  constructor(
    private readonly platform: string,
    private readonly events: HostEvents,
  ) {}

  get active() {
    return Boolean(this.session || this.pendingPeer);
  }

  async start(settings: Settings, id: string, password: string) {
    await this.stop();
    this.hostId = id;
    const room = join(settings, id, password);
    this.room = room;

    const hello = room.makeAction<Hello>('hello');
    const answer = room.makeAction<Answer>('answer');
    const status = room.makeAction<SessionStatus>('status');
    const bye = room.makeAction<null>('bye');
    const input = room.makeAction<InputEvent>('input');
    const control = room.makeAction<Control>('control');
    const challenge = room.makeAction<Challenge>('challenge');
    const proof = room.makeAction<Proof>('proof');
    const clip = room.makeAction<ClipboardData>('clip');
    const file = room.makeAction<ArrayBuffer>('file');
    const fileAck = room.makeAction<{ name: string; ok: boolean }>('fileack');
    this.sendClip = (data, peerId) => void clip.send(data, { target: peerId });
    this.sendChallenge = (data, peerId) => void challenge.send(data, { target: peerId });
    this.sendHello = (data, peerId) => void hello.send(data, { target: peerId });
    this.sendAnswer = (data, peerId) => void answer.send(data, { target: peerId });
    this.sendStatus = (data, peerId) => void status.send(data, { target: peerId });
    this.sendBye = (peerId) => void bye.send(null, { target: peerId });

    room.onPeerJoin = (peerId) => this.sendHello?.({ role: 'host', platform: this.platform }, peerId);
    room.onPeerLeave = (peerId) => this.peerGone(peerId);
    hello.onMessage = (data, { peerId }) => {
      if (data?.role !== 'viewer') return;
      void this.handleRequest(peerId, String(data.platform ?? '').slice(0, 20), {
        name: cleanName(data.name),
        id: cleanId(data.id),
        key: cleanKey(data.key),
      });
    };
    clip.onMessage = (data, { peerId }) => {
      const text = data?.text;
      if (this.controlAllowed(peerId) && typeof text === 'string' && text.length <= MAX_CLIPBOARD_CHARS) {
        window.api.writeClipboard(text);
      }
    };
    // Files are refused before any data arrives unless the sender may control this computer.
    file.onReceive = ({ peerId, byteLength }) => this.controlAllowed(peerId) && byteLength <= MAX_FILE_BYTES;
    file.onMessage = async (data, { peerId, metadata }) => {
      if (!this.controlAllowed(peerId)) return;
      const name = String((metadata as FileMeta | undefined)?.name ?? 'file').slice(0, 200);
      const buffer = data instanceof ArrayBuffer ? data : new Uint8Array(data as ArrayBufferLike).slice().buffer;
      const path = await window.api.saveReceivedFile(name, buffer).catch(() => null);
      void fileAck.send({ name, ok: Boolean(path) }, { target: peerId });
      this.events.onFileReceived(name, path);
    };
    proof.onMessage = (data, { peerId }) => {
      const waiter = this.proofWaiters.get(peerId);
      if (waiter && typeof data?.signature === 'string' && data.signature.length < 200) waiter(data.signature);
    };
    bye.onMessage = (_, { peerId }) => this.peerGone(peerId);
    input.onMessage = (ev, { peerId }) => {
      const s = this.session;
      if (s && peerId === s.peerId && s.canControl && !s.paused && ev && typeof ev === 'object') {
        window.api.sendInput(ev);
      }
    };
    control.onMessage = (data, { peerId }) => {
      if (peerId === this.session?.peerId && data?.quality in QUALITY_PRESETS) void this.tuneSender(peerId, data.quality);
    };
  }

  async stop() {
    this.endSession(false);
    this.pendingPeer = undefined;
    await this.room?.leave();
    this.room = undefined;
  }

  disconnect() {
    this.endSession(true);
  }

  // Sends this computer's clipboard to the viewer; only while it may control us.
  shareClipboard(text: string) {
    const peerId = this.session?.peerId;
    if (peerId && this.controlAllowed(peerId)) this.sendClip?.({ text }, peerId);
  }

  private controlAllowed(peerId: string) {
    const s = this.session;
    return Boolean(s && s.peerId === peerId && s.canControl && !s.paused);
  }

  setPaused(paused: boolean) {
    const s = this.session;
    if (!s || !s.canControl || s.paused === paused) return;
    s.paused = paused;
    this.sendStatus?.({ control: !paused }, s.peerId);
    this.events.onSessionChange({ ...s });
  }

  private async handleRequest(peerId: string, viewerPlatform: string, visitor: Visitor) {
    if (this.active) {
      if (peerId !== this.pendingPeer && peerId !== this.session?.peerId) {
        this.sendAnswer?.({ accepted: false, reason: 'busy' }, peerId);
      }
      return;
    }
    if ((this.declined.get(peerId) ?? 0) > Date.now()) {
      return this.sendAnswer?.({ accepted: false, reason: 'declined' }, peerId);
    }
    this.pendingPeer = peerId;

    // A remembered device skips the prompt once it proves it holds its private key.
    const print = visitor.key ? await fingerprint(visitor.key).catch(() => undefined) : undefined;
    const trusted = print && loadTrusted().find((d) => d.fingerprint === print && d.publicKey === visitor.key);
    if (trusted && (await this.verifyPeer(peerId, visitor.key!))) {
      if (this.pendingPeer !== peerId) return;
      this.pendingPeer = undefined;
      touchTrusted(trusted.fingerprint);
      const known = { ...visitor, name: visitor.name || trusted.name };
      return this.startSession(peerId, viewerPlatform, known, trusted.control, true);
    }

    const { choice, remember } = await this.events.confirm({ ...visitor, key: print ? visitor.key : undefined });
    if (this.pendingPeer !== peerId) return; // viewer left while the dialog was open
    if (choice === 'deny') {
      this.pendingPeer = undefined;
      this.declined.set(peerId, Date.now() + DECLINE_COOLDOWN_MS);
      return this.sendAnswer?.({ accepted: false, reason: 'declined' }, peerId);
    }
    const canControl = choice === 'control';
    const remembered = Boolean(remember && print && (await this.verifyPeer(peerId, visitor.key!)));
    if (this.pendingPeer !== peerId) return;
    this.pendingPeer = undefined;
    if (remembered) {
      addTrusted({ fingerprint: print!, publicKey: visitor.key!, name: visitor.name, id: visitor.id, control: canControl, added: Date.now() });
    }
    await this.startSession(peerId, viewerPlatform, visitor, canControl, remembered);
  }

  // Challenge-response: the viewer signs a fresh nonce bound to this computer's ID.
  private async verifyPeer(peerId: string, key: string): Promise<boolean> {
    const nonce = newNonce();
    const signature = await new Promise<string | undefined>((resolve) => {
      const timer = setTimeout(() => {
        this.proofWaiters.delete(peerId);
        resolve(undefined);
      }, PROOF_TIMEOUT_MS);
      this.proofWaiters.set(peerId, (sig) => {
        clearTimeout(timer);
        this.proofWaiters.delete(peerId);
        resolve(sig);
      });
      this.sendChallenge?.({ nonce }, peerId);
    });
    return Boolean(signature) && verify(key, challengeText(this.hostId, nonce), signature!);
  }

  private async startSession(
    peerId: string,
    viewerPlatform: string,
    visitor: Visitor,
    canControl: boolean,
    trusted: boolean,
  ) {
    this.session = { ...visitor, peerId, canControl, paused: false, startedAt: Date.now(), trusted };
    window.api.setSessionState('host');
    window.api.watchClipboard(true);
    this.events.onSessionChange({ ...this.session });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 60, max: 60 } },
        audio: false,
      });
    } catch (err) {
      console.error(err);
      this.sendAnswer?.({ accepted: false, reason: 'capture' }, peerId);
      this.endSession(false, 'capture');
      return;
    }
    if (this.session?.peerId !== peerId) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const { width = 0, height = 0 } = stream.getVideoTracks()[0].getSettings();
    window.api.sendInput({ t: 'hello', platform: viewerPlatform });
    this.sendAnswer?.({ accepted: true, control: canControl, screen: { width, height } }, peerId);
    await Promise.all(this.room!.addStream(stream, { target: peerId }));
    await this.tuneSender(peerId, 'auto');
  }

  private async tuneSender(peerId: string, quality: Quality) {
    const pc = this.room?.getPeers()[peerId];
    const track = this.stream?.getVideoTracks()[0];
    const sender = pc?.getSenders().find((s) => s.track === track);
    if (!sender) return;
    const preset = QUALITY_PRESETS[quality];
    const width = track!.getSettings().width ?? 0;
    track!.contentHint = preset.hint;
    const params = sender.getParameters();
    params.degradationPreference = preset.preference;
    for (const enc of params.encodings) {
      enc.maxBitrate = preset.bitrate;
      enc.maxFramerate = preset.fps;
      enc.scaleResolutionDownBy = Math.max(1, width / preset.maxWidth);
    }
    await sender.setParameters(params).catch(console.error);
  }

  private peerGone(peerId: string) {
    if (peerId === this.pendingPeer) this.pendingPeer = undefined;
    if (peerId === this.session?.peerId) this.endSession(false, 'partnerLeft');
  }

  private endSession(notifyPeer: boolean, error?: 'capture' | 'partnerLeft') {
    const peerId = this.session?.peerId;
    if (!peerId) return;
    this.session = undefined;
    if (notifyPeer) this.sendBye?.(peerId);
    if (this.stream) {
      this.room?.removeStream(this.stream, { target: peerId });
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = undefined;
    }
    window.api.setSessionState('idle');
    this.events.onSessionChange(null, error);
  }
}
