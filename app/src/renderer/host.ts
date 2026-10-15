import type { Room } from '@trystero-p2p/ws-relay';
import {
  MAX_NAME_LENGTH,
  QUALITY_SCALE,
  type Answer,
  type Control,
  type Hello,
  type InputEvent,
  type Quality,
  type SessionStatus,
} from '../../../shared/protocol';
import type { ConfirmChoice } from '../preload/api';
import { join } from './network';
import type { Settings } from './settings';

const QUALITY_PRESETS: Record<Quality, { bitrate: number; preference: RTCDegradationPreference }> = {
  auto: { bitrate: 8_000_000, preference: 'balanced' },
  speed: { bitrate: 2_500_000, preference: 'maintain-framerate' },
  quality: { bitrate: 16_000_000, preference: 'maintain-resolution' },
};

// After a refusal the same peer can't pop up another dialog for a while.
const DECLINE_COOLDOWN_MS = 20_000;

export interface Visitor {
  name: string;
  id: string;
}

export interface HostSession extends Visitor {
  canControl: boolean;
  paused: boolean;
  startedAt: number;
}

export interface HostEvents {
  confirm(visitor: Visitor): Promise<ConfirmChoice>;
  onSessionChange(session: HostSession | null, error?: 'capture' | 'partnerLeft'): void;
}

const cleanName = (value: unknown) =>
  String(value ?? '')
    .replace(/[\p{C}]/gu, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

const cleanId = (value: unknown) => (/^\d{9}$/.test(String(value)) ? String(value) : '');

// Waits in the room named after this computer's ID and serves one viewer at a time.
export class Host {
  private room?: Room;
  private session?: HostSession & { peerId: string };
  private pendingPeer?: string;
  private stream?: MediaStream;
  private declined = new Map<string, number>();
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
    const room = join(settings, id, password);
    this.room = room;

    const hello = room.makeAction<Hello>('hello');
    const answer = room.makeAction<Answer>('answer');
    const status = room.makeAction<SessionStatus>('status');
    const bye = room.makeAction<null>('bye');
    const input = room.makeAction<InputEvent>('input');
    const control = room.makeAction<Control>('control');
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
      });
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
    const choice = await this.events.confirm(visitor);
    if (this.pendingPeer !== peerId) return; // viewer left while the dialog was open
    this.pendingPeer = undefined;
    if (choice === 'deny') {
      this.declined.set(peerId, Date.now() + DECLINE_COOLDOWN_MS);
      return this.sendAnswer?.({ accepted: false, reason: 'declined' }, peerId);
    }
    await this.startSession(peerId, viewerPlatform, visitor, choice === 'control');
  }

  private async startSession(peerId: string, viewerPlatform: string, visitor: Visitor, canControl: boolean) {
    this.session = { ...visitor, peerId, canControl, paused: false, startedAt: Date.now() };
    window.api.setSessionState('host');
    this.events.onSessionChange({ ...this.session });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
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
    stream.getVideoTracks()[0].contentHint = 'detail';
    window.api.sendInput({ t: 'hello', platform: viewerPlatform });
    this.sendAnswer?.({ accepted: true, control: canControl }, peerId);
    await Promise.all(this.room!.addStream(stream, { target: peerId }));
    await this.tuneSender(peerId, 'auto');
  }

  private async tuneSender(peerId: string, quality: Quality) {
    const pc = this.room?.getPeers()[peerId];
    const track = this.stream?.getVideoTracks()[0];
    const sender = pc?.getSenders().find((s) => s.track === track);
    if (!sender) return;
    const preset = QUALITY_PRESETS[quality];
    const params = sender.getParameters();
    params.degradationPreference = preset.preference;
    for (const enc of params.encodings) {
      enc.maxBitrate = preset.bitrate;
      enc.scaleResolutionDownBy = QUALITY_SCALE[quality];
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
