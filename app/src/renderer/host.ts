import type { Room } from '@trystero-p2p/ws-relay';
import { QUALITY_SCALE, type Answer, type Control, type Hello, type InputEvent, type Quality } from '../../../shared/protocol';
import { join } from './network';
import type { Settings } from './settings';

const QUALITY_PRESETS: Record<Quality, { bitrate: number; preference: RTCDegradationPreference }> = {
  auto: { bitrate: 8_000_000, preference: 'balanced' },
  speed: { bitrate: 2_500_000, preference: 'maintain-framerate' },
  quality: { bitrate: 16_000_000, preference: 'maintain-resolution' },
};

export interface HostEvents {
  confirm(): Promise<boolean>;
  onSessionChange(active: boolean, error?: 'capture' | 'partnerLeft'): void;
}

// Waits in the room named after this computer's ID and serves one viewer at a time.
export class Host {
  private room?: Room;
  private sessionPeer?: string;
  private pendingPeer?: string;
  private stream?: MediaStream;
  private sendHello?: (data: Hello, peerId: string) => void;
  private sendAnswer?: (data: Answer, peerId: string) => void;
  private sendBye?: (peerId: string) => void;

  constructor(
    private readonly platform: string,
    private readonly events: HostEvents,
  ) {}

  get active() {
    return Boolean(this.sessionPeer || this.pendingPeer);
  }

  async start(settings: Settings, id: string, password: string) {
    await this.stop();
    const room = join(settings, id, password);
    this.room = room;

    const hello = room.makeAction<Hello>('hello');
    const answer = room.makeAction<Answer>('answer');
    const bye = room.makeAction<null>('bye');
    const input = room.makeAction<InputEvent>('input');
    const control = room.makeAction<Control>('control');
    this.sendHello = (data, peerId) => void hello.send(data, { target: peerId });
    this.sendAnswer = (data, peerId) => void answer.send(data, { target: peerId });
    this.sendBye = (peerId) => void bye.send(null, { target: peerId });

    room.onPeerJoin = (peerId) => this.sendHello?.({ role: 'host', platform: this.platform }, peerId);
    room.onPeerLeave = (peerId) => this.peerGone(peerId);
    hello.onMessage = (data, { peerId }) => {
      if (data?.role === 'viewer') void this.handleRequest(peerId, String(data.platform));
    };
    bye.onMessage = (_, { peerId }) => this.peerGone(peerId);
    input.onMessage = (ev, { peerId }) => {
      if (peerId === this.sessionPeer) window.api.sendInput(ev);
    };
    control.onMessage = (data, { peerId }) => {
      if (peerId === this.sessionPeer && data?.quality in QUALITY_PRESETS) void this.tuneSender(peerId, data.quality);
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

  private async handleRequest(peerId: string, viewerPlatform: string) {
    if (this.active) return this.sendAnswer?.({ accepted: false, reason: 'busy' }, peerId);
    this.pendingPeer = peerId;
    const allowed = await this.events.confirm();
    if (this.pendingPeer !== peerId) return; // viewer left while the dialog was open
    this.pendingPeer = undefined;
    if (!allowed) return this.sendAnswer?.({ accepted: false, reason: 'declined' }, peerId);
    await this.startSession(peerId, viewerPlatform);
  }

  private async startSession(peerId: string, viewerPlatform: string) {
    this.sessionPeer = peerId;
    window.api.setSessionState('host');
    this.events.onSessionChange(true);

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
    if (this.sessionPeer !== peerId) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    stream.getVideoTracks()[0].contentHint = 'detail';
    window.api.sendInput({ t: 'hello', platform: viewerPlatform });
    this.sendAnswer?.({ accepted: true }, peerId);
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
    if (peerId === this.sessionPeer) this.endSession(false, 'partnerLeft');
  }

  private endSession(notifyPeer: boolean, error?: 'capture' | 'partnerLeft') {
    const peerId = this.sessionPeer;
    if (!peerId) return;
    this.sessionPeer = undefined;
    if (notifyPeer) this.sendBye?.(peerId);
    if (this.stream) {
      this.room?.removeStream(this.stream, { target: peerId });
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = undefined;
    }
    window.api.setSessionState('idle');
    this.events.onSessionChange(false, error);
  }
}
