import type { Room } from '@trystero-p2p/ws-relay';
import type { Answer, AnswerReason, Control, Hello, InputEvent, SessionStatus } from '../../../shared/protocol';
import { join } from './network';
import type { Settings } from './settings';

const FIND_TIMEOUT_MS = 30_000;
const ACCEPT_TIMEOUT_MS = 60_000;

export type ViewerError = AnswerReason | 'wrongPassword' | 'notFound' | 'noResponse' | 'partnerLeft';
export type ViewerStatus = 'searching' | 'waiting';

export interface ViewerSession {
  hostPlatform: string;
  // False when the host granted view-only access or paused control.
  canControl: boolean;
  onControlChange?: (canControl: boolean) => void;
  sendInput(ev: InputEvent): void;
  sendControl(control: Control): void;
  connection(): RTCPeerConnection | undefined;
}

export interface ViewerEvents {
  onStatus(status: ViewerStatus): void;
  onConnected(session: ViewerSession): void;
  onStream(stream: MediaStream): void;
  onEnd(error?: ViewerError): void;
}

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

  connect(settings: Settings, partnerId: string, password: string, identity: { name: string; id: string }) {
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
    let session: ViewerSession | undefined;

    room.onPeerJoin = (peerId) =>
      void hello.send({ role: 'viewer', platform: this.platform, ...identity }, { target: peerId });
    hello.onMessage = (data, { peerId }) => {
      if (data?.role !== 'host' || this.hostPeer) return;
      this.hostPeer = peerId;
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
        sendInput: (ev) => void input.send(ev, { target: peerId }),
        sendControl: (c) => void control.send(c, { target: peerId }),
        connection: () => this.room?.getPeers()[peerId],
      };
      this.events.onConnected(session);
    };
    status.onMessage = (data, { peerId }) => {
      if (!session || peerId !== this.hostPeer || typeof data?.control !== 'boolean') return;
      session.canControl = data.control;
      session.onControlChange?.(data.control);
    };
    room.onPeerStream = (stream, peerId) => {
      if (peerId === this.hostPeer) this.events.onStream(stream);
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
