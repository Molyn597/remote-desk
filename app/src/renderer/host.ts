import type { Room } from '@trystero-p2p/ws-relay';
import {
  ALL_DISPLAYS,
  MAX_CLIPBOARD_CHARS,
  MAX_FILE_BYTES,
  MAX_NAME_LENGTH,
  type Answer,
  type Challenge,
  type ClipboardData,
  type Control,
  type DisplayInfo,
  type DisplayLayout,
  type FavoriteAnswer,
  type FavoriteRequest,
  type FileMeta,
  type FileOffer,
  type FileRequest,
  type Hello,
  type InputEvent,
  type Pairing,
  type PowerRequest,
  type Proof,
  POWER_ACTIONS,
  type Quality,
  type SessionStatus,
  trustedRoom,
} from '../../../shared/protocol';
import type { ConfirmChoice } from '../preload/api';
import { captureAudio, captureView, type Capture } from './capture';
import { preferHardwareCodec, readEncoderStats } from './encoding';
import { challengeText, fingerprint, newNonce, verify } from './identity';
import { logError, logInfo, logWarn, watchConnection } from './log';
import { join } from './network';
import { addTrusted, loadTrusted, loadTrustSecret, touchTrusted, type Settings } from './settings';

// Encoding a full Retina/4K screen is slow, so most presets cap the width. "auto" keeps
// 1920 px and gives up frames first when the network or encoder can't keep up, because
// text below 1920 px is hard to read; "speed" keeps 60 fps and gives up resolution.
const QUALITY_PRESETS: Record<
  Quality,
  { bitrate: number; maxWidth: number; fps: number; preference: RTCDegradationPreference; hint: string }
> = {
  auto: { bitrate: 16_000_000, maxWidth: 1920, fps: 60, preference: 'maintain-resolution', hint: 'detail' },
  speed: { bitrate: 4_000_000, maxWidth: 1280, fps: 60, preference: 'maintain-framerate', hint: 'motion' },
  quality: { bitrate: 25_000_000, maxWidth: Infinity, fps: 30, preference: 'maintain-resolution', hint: 'detail' },
  saver: { bitrate: 3_000_000, maxWidth: 1920, fps: 30, preference: 'maintain-resolution', hint: 'detail' },
};

preferHardwareCodec();

// How often the host checks its encoder, and how many checks in a row may be CPU-bound
// before "Automatic" drops from 60 to 30 fps.
const ENCODER_CHECK_MS = 5000;
const CPU_LIMIT_CHECKS = 2;

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
  // The connected viewer asks to add this computer to its favorites (no password next time).
  confirmFavorite(visitor: Visitor): Promise<ConfirmChoice>;
  onSessionChange(session: HostSession | null, error?: 'capture' | 'partnerLeft'): void;
  onFileReceived(name: string, path: string | null): void;
  onFileSent(name: string): void;
  pickerTitle(): string;
  // Shown on this computer's blacked-out monitors.
  privacyMessage(visitor: Visitor): string;
  // The viewer locks, sleeps, restarts or shuts down this computer.
  onPowerAction(visitor: Visitor, action: PowerRequest['action']): void;
}

const cleanName = (value: unknown) =>
  String(value ?? '')
    .replace(/[\p{C}]/gu, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);

const cleanId = (value: unknown) => (/^\d{9}$/.test(String(value)) ? String(value) : '');

const cleanKey = (value: unknown) =>
  typeof value === 'string' && value.length < 300 && /^[A-Za-z0-9+/]+={0,2}$/.test(value) ? value : undefined;


// One joined room and how to talk to peers in it.
interface Link {
  room: Room;
  // The trusted-device room: only remembered devices that prove their key get in.
  trustedOnly: boolean;
  send: {
    hello(data: Hello, peerId: string): void;
    answer(data: Answer, peerId: string): void;
    status(data: SessionStatus, peerId: string): void;
    bye(peerId: string): void;
    challenge(data: Challenge, peerId: string): void;
    clip(data: ClipboardData, peerId: string): void;
    offer(data: FileOffer[], peerId: string): void;
    layout(data: DisplayLayout, peerId: string): void;
    pair(data: Pairing, peerId: string): void;
    favorite(data: FavoriteAnswer, peerId: string): void;
    file(offer: FileOffer, peerId: string): Promise<void>;
  };
}

type Peer = { peerId: string; link: Link };

// Waits in the room named after this computer's ID (password) and, once some device is
// trusted, in the trusted-device room too. Serves one viewer at a time.
export class Host {
  private links: Link[] = [];
  private trustedLink?: Link;
  private settings?: Settings;
  private session?: HostSession & Peer;
  private pending?: Peer;
  private stream?: MediaStream;
  private capture?: Capture;
  private audio?: MediaStreamTrack;
  private displays: DisplayInfo[] = [];
  private view = '';
  private quality: Quality = 'auto';
  private switching = Promise.resolve();
  private declined = new Map<string, number>();
  private hostId = '';
  private proofWaiters = new Map<string, (signature: string) => void>();
  // While the favorite prompt is open the viewer's input is blocked, so it can't approve itself.
  private approving = false;
  // Privacy screen: allowed by the owner in Settings, for favorites only, Windows only.
  private privacyAllowed = false;
  private privacy = false;
  private encoderTimer = 0;
  private cpuChecks = 0;
  private cpuLimited = false;
  // After a dropped connection the same device (proven by its key) may come straight back.
  private rejoin?: { key: string; canControl: boolean; trusted: boolean; until: number };

  constructor(
    private readonly platform: string,
    private readonly events: HostEvents,
  ) {}

  get active() {
    return Boolean(this.session || this.pending);
  }

  async start(settings: Settings, id: string, password: string) {
    await this.stop();
    this.hostId = id;
    this.settings = settings;
    this.links = [this.openRoom(join(settings, id, password), false)];
    logInfo('host', `waiting for connections (${settings.serverUrl ? 'own server' : 'public network'}${settings.turnUrl ? ', TURN set' : ''})`);
    this.syncTrustedRoom();
  }

  // Joins the trusted-device room while any device is trusted, leaves it when none is.
  syncTrustedRoom() {
    if (!this.settings) return;
    const wanted = loadTrusted().length > 0;
    if (wanted && !this.trustedLink) {
      const room = join(this.settings, trustedRoom(this.hostId), loadTrustSecret());
      this.trustedLink = this.openRoom(room, true);
      this.links.push(this.trustedLink);
      logInfo('host', 'trusted-device room open');
    } else if (!wanted && this.trustedLink && this.session?.link !== this.trustedLink) {
      const link = this.trustedLink;
      this.trustedLink = undefined;
      this.links = this.links.filter((l) => l !== link);
      if (this.pending?.link === link) this.pending = undefined;
      void link.room.leave();
      logInfo('host', 'trusted-device room closed (no trusted devices)');
    }
  }

  // After the trust secret was replaced the trusted room must be rejoined with the new key.
  async restartTrustedRoom() {
    const link = this.trustedLink;
    if (link) {
      if (this.session?.link === link) this.endSession(true);
      if (this.pending?.link === link) this.pending = undefined;
      this.trustedLink = undefined;
      this.links = this.links.filter((l) => l !== link);
      await link.room.leave();
    }
    this.syncTrustedRoom();
  }

  private openRoom(room: Room, trustedOnly: boolean): Link {
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
    const offer = room.makeAction<FileOffer[]>('offer');
    const request = room.makeAction<FileRequest>('pull');
    const layout = room.makeAction<DisplayLayout>('displays');
    const pair = room.makeAction<Pairing>('pair');
    const favorite = room.makeAction<FavoriteRequest>('favorite');
    const favoriteAnswer = room.makeAction<FavoriteAnswer>('favans');
    const power = room.makeAction<PowerRequest>('power');

    const link: Link = {
      room,
      trustedOnly,
      send: {
        hello: (data, peerId) => void hello.send(data, { target: peerId }),
        answer: (data, peerId) => void answer.send(data, { target: peerId }),
        status: (data, peerId) => void status.send(data, { target: peerId }),
        bye: (peerId) => void bye.send(null, { target: peerId }),
        challenge: (data, peerId) => void challenge.send(data, { target: peerId }),
        clip: (data, peerId) => void clip.send(data, { target: peerId }),
        offer: (data, peerId) => void offer.send(data, { target: peerId }),
        layout: (data, peerId) => void layout.send(data, { target: peerId }),
        pair: (data, peerId) => void pair.send(data, { target: peerId }),
        favorite: (data, peerId) => void favoriteAnswer.send(data, { target: peerId }),
        file: async ({ id }, peerId) => {
          const read = await window.api.readOfferedFile(id);
          if (!read || !this.controlAllowed(peerId, link)) return;
          const meta: FileMeta = { name: read.name, size: read.data.byteLength };
          await file.send(read.data, { target: peerId, metadata: meta });
          this.events.onFileSent(read.name);
        },
      },
    };
    const inSession = (peerId: string) => this.session?.peerId === peerId && this.session.link === link;

    // The viewer asks for files copied here, or for a picker on this screen.
    request.onMessage = async (data, { peerId }) => {
      if (!this.controlAllowed(peerId, link)) return;
      const offers = data?.pick
        ? await window.api.pickFilesToSend(this.events.pickerTitle())
        : (Array.isArray(data?.ids) ? data.ids : []).slice(0, 20).map((id) => ({ id: String(id), name: '', size: 0 }));
      for (const item of offers) {
        if (!this.controlAllowed(peerId, link)) break;
        await link.send.file(item, peerId).catch(console.error);
      }
    };
    room.onPeerJoin = (peerId) =>
      link.send.hello({ role: 'host', platform: this.platform, name: this.settings?.displayName || undefined }, peerId);
    room.onPeerLeave = (peerId) => this.peerGone(peerId, link);
    hello.onMessage = (data, { peerId }) => {
      if (data?.role !== 'viewer') return;
      void this.handleRequest({ peerId, link }, String(data.platform ?? '').slice(0, 20), {
        name: cleanName(data.name),
        id: cleanId(data.id),
        key: cleanKey(data.key),
      });
    };
    clip.onMessage = (data, { peerId }) => {
      const text = data?.text;
      if (this.controlAllowed(peerId, link) && typeof text === 'string' && text.length <= MAX_CLIPBOARD_CHARS) {
        window.api.writeClipboard(text);
      }
    };
    // Files are refused before any data arrives unless the sender may control this computer.
    file.onReceive = ({ peerId, byteLength }) => this.controlAllowed(peerId, link) && byteLength <= MAX_FILE_BYTES;
    file.onMessage = async (data, { peerId, metadata }) => {
      if (!this.controlAllowed(peerId, link)) return;
      const name = String((metadata as FileMeta | undefined)?.name ?? 'file').slice(0, 200);
      const buffer = data instanceof ArrayBuffer ? data : new Uint8Array(data as ArrayBufferLike).slice().buffer;
      const path = await window.api.saveReceivedFile(name, buffer).catch(() => null);
      const size = `${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`;
      if (path) logInfo('host', `file received (${size})`);
      else logError('host', `saving a received file failed (${size})`);
      void fileAck.send({ name, ok: Boolean(path) }, { target: peerId });
      this.events.onFileReceived(name, path);
    };
    proof.onMessage = (data, { peerId }) => {
      const waiter = this.proofWaiters.get(peerId);
      if (waiter && typeof data?.signature === 'string' && data.signature.length < 200) waiter(data.signature);
    };
    bye.onMessage = (_, { peerId }) => this.peerGone(peerId, link);
    input.onMessage = (ev, { peerId }) => {
      if (this.controlAllowed(peerId, link) && ev && typeof ev === 'object') window.api.sendInput(ev);
    };
    power.onMessage = (data, { peerId }) => {
      const action = data?.action;
      const s = this.session;
      if (!s || !this.controlAllowed(peerId, link) || !POWER_ACTIONS.includes(action)) return;
      logInfo('host', `power action from ${s.id || 'viewer'}: ${action}`);
      this.events.onPowerAction(s, action);
      window.api.powerAction(action);
    };
    favorite.onMessage = (_, { peerId }) => {
      if (inSession(peerId)) void this.handleFavorite();
    };
    control.onMessage = (data, { peerId }) => {
      if (!inSession(peerId)) return;
      if (typeof data?.quality === 'string' && data.quality in QUALITY_PRESETS) {
        this.quality = data.quality;
        logInfo('host', `viewer asked for quality: ${data.quality}`);
        void this.tuneSender();
      }
      if (typeof data?.view === 'string') this.switchView(peerId, data.view);
      if (typeof data?.privacy === 'boolean') this.setPrivacy(data.privacy);
    };
    return link;
  }

  async stop() {
    this.endSession(false);
    this.pending = undefined;
    const links = this.links;
    this.links = [];
    this.trustedLink = undefined;
    await Promise.all(links.map((l) => l.room.leave()));
  }

  disconnect() {
    this.endSession(true);
  }

  // Tells the viewer about files copied on this computer; nothing is sent until it asks.
  offerFiles(offers: FileOffer[]) {
    const s = this.session;
    if (s && this.controlAllowed(s.peerId, s.link)) s.link.send.offer(offers, s.peerId);
  }

  // Sends this computer's clipboard to the viewer; only while it may control us.
  shareClipboard(text: string) {
    const s = this.session;
    if (s && this.controlAllowed(s.peerId, s.link)) s.link.send.clip({ text }, s.peerId);
  }

  private controlAllowed(peerId: string, link: Link) {
    const s = this.session;
    return Boolean(s && s.peerId === peerId && s.link === link && s.canControl && !s.paused && !this.approving);
  }

  // Asked from the viewer's toolbar. Someone at this computer has to approve it.
  private async handleFavorite() {
    const s = this.session;
    if (!s || this.approving) return;
    const { peerId, link } = s;
    const answer = (accepted: boolean) => link.send.favorite({ accepted }, peerId);
    const print = s.key ? await fingerprint(s.key).catch(() => undefined) : undefined;
    if (!print) return answer(false);
    if (loadTrusted().some((d) => d.fingerprint === print && d.publicKey === s.key)) {
      link.send.pair({ secret: loadTrustSecret() }, peerId);
      return answer(true);
    }
    logInfo('host', `${s.id || 'viewer'} asks to add this computer to favorites`);
    this.approving = true;
    let choice: ConfirmChoice = 'deny';
    try {
      choice = await this.events.confirmFavorite(s);
      if (choice !== 'deny' && !(await this.verifyPeer({ peerId, link }, s.key!))) choice = 'deny';
    } finally {
      this.approving = false;
    }
    logInfo('host', `favorite request ${choice === 'deny' ? 'declined' : `allowed (${choice})`}`);
    if (this.session !== s) return;
    if (choice === 'deny') return answer(false);
    addTrusted({ fingerprint: print, publicKey: s.key!, name: s.name, id: s.id, control: choice === 'control', added: Date.now() });
    this.syncTrustedRoom();
    s.trusted = true;
    this.events.onSessionChange({ ...s });
    link.send.pair({ secret: loadTrustSecret() }, peerId);
    answer(true);
  }

  setPaused(paused: boolean) {
    const s = this.session;
    if (!s || !s.canControl || s.paused === paused) return;
    s.paused = paused;
    this.sendStatus();
    this.events.onSessionChange({ ...s });
  }

  private sendStatus() {
    const s = this.session;
    if (s) s.link.send.status({ control: s.canControl && !s.paused, privacy: this.privacy }, s.peerId);
  }

  private privacyAvailable() {
    const s = this.session;
    return Boolean(this.privacyAllowed && this.platform === 'win32' && s?.trusted && s.canControl);
  }

  setPrivacyAllowed(allowed: boolean) {
    this.privacyAllowed = allowed;
    if (!allowed) this.setPrivacy(false);
  }

  private setPrivacy(on: boolean) {
    const s = this.session;
    if (!s || (on && !this.privacyAvailable()) || on === this.privacy) return;
    this.privacy = on;
    logInfo('host', on ? 'privacy screen on' : 'privacy screen off');
    window.api.setPrivacyScreen(on, this.events.privacyMessage(s));
    this.sendStatus();
  }

  // Someone at this computer moved the mouse, which always lifts the privacy screen.
  privacyLifted() {
    if (!this.privacy) return;
    this.privacy = false;
    logInfo('host', 'privacy screen lifted by local mouse');
    this.sendStatus();
  }

  private isPending({ peerId, link }: Peer) {
    return this.pending?.peerId === peerId && this.pending.link === link;
  }

  private async handleRequest(peer: Peer, viewerPlatform: string, visitor: Visitor) {
    const { peerId, link } = peer;
    const where = link.trustedOnly ? 'trusted room' : 'password room';
    if (this.active) {
      const current = this.isPending(peer) || (this.session?.peerId === peerId && this.session.link === link);
      if (!current) {
        logInfo('host', `request from ${visitor.id || 'unknown ID'} refused: busy`);
        link.send.answer({ accepted: false, reason: 'busy' }, peerId);
      }
      return;
    }
    if ((this.declined.get(peerId) ?? 0) > Date.now()) {
      logInfo('host', `request from ${visitor.id || 'unknown ID'} refused: declined recently`);
      return link.send.answer({ accepted: false, reason: 'declined' }, peerId);
    }
    logInfo('host', `connection request from ${visitor.id || 'unknown ID'} (${viewerPlatform || '?'}, ${where})`);
    this.pending = peer;

    // A remembered device skips the prompt once it proves it holds its private key.
    const print = visitor.key ? await fingerprint(visitor.key).catch(() => undefined) : undefined;
    const trusted = print && loadTrusted().find((d) => d.fingerprint === print && d.publicKey === visitor.key);
    const verified = Boolean(trusted) && (await this.verifyPeer(peer, visitor.key!));
    if (trusted && !verified) logWarn('host', 'trusted device failed to prove its key');
    if (trusted && verified) {
      if (!this.isPending(peer)) return;
      logInfo('host', 'trusted device verified, no prompt');
      this.pending = undefined;
      touchTrusted(trusted.fingerprint);
      const known = { ...visitor, name: visitor.name || trusted.name };
      return this.startSession(peer, viewerPlatform, known, trusted.control, true);
    }
    // Coming back after a dropped connection: same device key, within two minutes, no prompt.
    const back = this.rejoin;
    if (back && visitor.key === back.key && Date.now() < back.until && (await this.verifyPeer(peer, visitor.key))) {
      if (!this.isPending(peer)) return;
      this.pending = undefined;
      this.rejoin = undefined;
      logInfo('host', 'device reconnected after a dropped connection, no prompt');
      return this.startSession(peer, viewerPlatform, visitor, back.canControl, back.trusted);
    }
    // Nobody is asked in the trusted room: unknown or removed devices are simply turned away.
    if (link.trustedOnly) {
      logWarn('host', 'refused in trusted room: device is not trusted');
      if (this.isPending(peer)) this.pending = undefined;
      this.declined.set(peerId, Date.now() + DECLINE_COOLDOWN_MS);
      return link.send.answer({ accepted: false, reason: 'untrusted' }, peerId);
    }

    const { choice, remember } = await this.events.confirm({ ...visitor, key: print ? visitor.key : undefined });
    if (!this.isPending(peer)) return logInfo('host', 'viewer left while the prompt was open');
    logInfo('host', `prompt answered: ${choice}${remember ? ', remember device' : ''}`);
    if (choice === 'deny') {
      this.pending = undefined;
      this.declined.set(peerId, Date.now() + DECLINE_COOLDOWN_MS);
      return link.send.answer({ accepted: false, reason: 'declined' }, peerId);
    }
    const canControl = choice === 'control';
    const remembered = Boolean(remember && print && (await this.verifyPeer(peer, visitor.key!)));
    if (!this.isPending(peer)) return;
    this.pending = undefined;
    if (remembered) {
      addTrusted({ fingerprint: print!, publicKey: visitor.key!, name: visitor.name, id: visitor.id, control: canControl, added: Date.now() });
      this.syncTrustedRoom();
    }
    await this.startSession(peer, viewerPlatform, visitor, canControl, remembered);
  }

  // Challenge-response: the viewer signs a fresh nonce bound to this computer's ID.
  private async verifyPeer({ peerId, link }: Peer, key: string): Promise<boolean> {
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
      link.send.challenge({ nonce }, peerId);
    });
    return Boolean(signature) && verify(key, challengeText(this.hostId, nonce), signature!);
  }

  private async startSession(peer: Peer, viewerPlatform: string, visitor: Visitor, canControl: boolean, trusted: boolean) {
    const { peerId, link } = peer;
    this.session = { ...visitor, ...peer, canControl, paused: false, startedAt: Date.now(), trusted };
    window.api.setSessionState('host');
    window.api.watchClipboard(true);
    this.events.onSessionChange({ ...this.session });

    // The main monitor first; the viewer can switch to another one or to all of them.
    let capture: Capture;
    try {
      this.displays = await window.api.getDisplays();
      this.view = this.displays.find((d) => d.primary)?.id ?? '';
      this.quality = 'auto';
      capture = await captureView(this.view, this.displays);
    } catch (err) {
      logError('host', `screen capture failed: ${err instanceof Error ? `${err.name}: ${err.message}` : err}`);
      link.send.answer({ accepted: false, reason: 'capture' }, peerId);
      this.endSession(false, 'capture');
      return;
    }
    if (this.session?.peerId !== peerId || this.session.link !== link) {
      capture.stop();
      return;
    }
    this.capture = capture;
    this.audio = await captureAudio();
    logInfo('host', this.audio ? 'sharing system sound' : 'system sound not available');
    if (this.session?.peerId !== peerId || this.session.link !== link) {
      capture.stop();
      this.capture = undefined;
      this.audio?.stop();
      this.audio = undefined;
      return;
    }
    this.stream = new MediaStream(this.audio ? [capture.track, this.audio] : [capture.track]);
    window.api.setInputView(this.view);
    window.api.sendInput({ t: 'hello', platform: viewerPlatform });
    const screen = { width: capture.width, height: capture.height };
    logInfo('host', `session started (${canControl ? 'control' : 'view only'}${trusted ? ', trusted' : ''}, ${this.displays.length} monitor(s), ${screen.width}×${screen.height})`);
    watchConnection('host', link.room.getPeers()[peerId]);
    this.privacy = false;
    link.send.answer({ accepted: true, control: canControl, screen, privacy: this.privacyAvailable() }, peerId);
    link.send.layout({ displays: this.displays, view: this.view, screen }, peerId);
    // A verified trusted device gets the key to come back without the password.
    if (trusted) link.send.pair({ secret: loadTrustSecret() }, peerId);
    await Promise.all(link.room.addStream(this.stream, { target: peerId }));
    this.cpuLimited = false;
    this.cpuChecks = 0;
    await this.tuneSender();
    this.watchEncoder();
  }

  // Swaps the picture to another monitor (or all of them) without renegotiating the connection.
  private switchView(peerId: string, view: string) {
    this.switching = this.switching.then(async () => {
      const s = this.session;
      if (s?.peerId !== peerId || !this.capture || !this.stream) return;
      this.displays = await window.api.getDisplays();
      if (view !== ALL_DISPLAYS && !this.displays.some((d) => d.id === view)) return;
      if (view === ALL_DISPLAYS && this.displays.length < 2) return;
      const next = await captureView(view, this.displays).catch((err) => logError('host', `switching monitor failed: ${err}`));
      if (!next) return;
      const old = this.capture;
      const sender = s.link.room.getPeers()[peerId]?.getSenders().find((x) => x.track === old.track);
      if (this.session !== s || !sender) return next.stop();
      await sender.replaceTrack(next.track);
      this.stream.removeTrack(old.track);
      this.stream.addTrack(next.track);
      this.capture = next;
      old.stop();
      this.view = view;
      logInfo('host', view === ALL_DISPLAYS ? 'showing all monitors' : `showing monitor ${this.displays.findIndex((d) => d.id === view) + 1}`);
      window.api.setInputView(view);
      s.link.send.layout({ displays: this.displays, view, screen: { width: next.width, height: next.height } }, peerId);
      await this.tuneSender();
    });
  }

  private async tuneSender() {
    const s = this.session;
    const pc = s && s.link.room.getPeers()[s.peerId];
    const track = this.capture?.track;
    const sender = pc?.getSenders().find((x) => x.track === track);
    if (!sender || !track) return;
    const preset = { ...QUALITY_PRESETS[this.quality] };
    // All monitors in one picture: allow it to stay twice as wide.
    if (this.view === ALL_DISPLAYS) preset.maxWidth *= 2;
    // The computer can't encode 60 fps in time: ask for 30 so frames keep coming evenly.
    if (this.cpuLimited && this.quality === 'auto') preset.fps = 30;
    // One monitor on a Mac: have the system capture it already scaled down (on the graphics chip),
    // so a Retina screen isn't captured at full size only to be shrunk again before encoding.
    // Windows capture breaks when resized this way (a distorted size at ~2 fps), so there the
    // encoder scales the picture instead.
    if (this.view !== ALL_DISPLAYS && this.platform === 'darwin') {
      const limit = Number.isFinite(preset.maxWidth) ? { width: { max: preset.maxWidth }, height: { max: preset.maxWidth } } : {};
      // Capture no more frames than the mode sends.
      await track.applyConstraints({ ...limit, frameRate: { ideal: preset.fps, max: preset.fps } }).catch((err) => logInfo('host', `capture size not limited: ${err}`));
    }
    const width = track.getSettings().width || this.capture!.width;
    track.contentHint = preset.hint;
    const params = sender.getParameters();
    params.degradationPreference = preset.preference;
    for (const enc of params.encodings) {
      enc.maxBitrate = preset.bitrate;
      enc.maxFramerate = preset.fps;
      enc.scaleResolutionDownBy = Math.max(1, width / preset.maxWidth);
    }
    await sender.setParameters(params).catch(console.error);
  }

  // Logs the encoder now and then and eases off when the processor can't keep up.
  private watchEncoder() {
    clearInterval(this.encoderTimer);
    let tick = 0;
    let lastLine = '';
    let lastPli = 0;
    let lastAvailable = 0;
    this.encoderTimer = window.setInterval(async () => {
      const s = this.session;
      const track = this.capture?.track;
      const pc = s && s.link.room.getPeers()[s.peerId];
      const sender = pc?.getSenders().find((x) => x.track === track);
      if (!sender) return;
      const st = await readEncoderStats(sender, pc).catch(() => undefined);
      if (!st) return;
      const mbps = (n: number) => n.toFixed(1);
      const line = `encoder ${st.codec} ${st.encoder}${st.hardware === undefined ? '' : st.hardware ? ' (hardware)' : ' (software)'}, ${st.width}×${st.height} @${st.fps} fps, ${this.quality}, target ${mbps(st.target)} of ${st.available === undefined ? '?' : mbps(st.available)} Mb/s available, limited by ${st.limitedBy}`;
      if (tick++ % 3 === 0 || line.split(',')[0] !== lastLine.split(',')[0]) logInfo('host', line);
      lastLine = line;
      // Moments that freeze the picture on the other side.
      if (st.pli > lastPli) logWarn('host', `viewer lost data and asked for a full picture (${st.pli - lastPli}×)`);
      if (st.available !== undefined && lastAvailable > 2 && st.available < lastAvailable * 0.6)
        logWarn('host', `connection estimate fell from ${mbps(lastAvailable)} to ${mbps(st.available)} Mb/s`);
      lastPli = st.pli;
      lastAvailable = st.available ?? lastAvailable;
      this.cpuChecks = st.limitedBy === 'cpu' ? this.cpuChecks + 1 : 0;
      if (!this.cpuLimited && this.cpuChecks >= CPU_LIMIT_CHECKS && this.quality === 'auto') {
        this.cpuLimited = true;
        logInfo('host', 'encoder is CPU-bound: Automatic quality drops to 30 fps');
        await this.tuneSender();
      }
    }, ENCODER_CHECK_MS);
  }

  private peerGone(peerId: string, link: Link) {
    if (this.isPending({ peerId, link })) this.pending = undefined;
    if (this.session?.peerId === peerId && this.session.link === link) this.endSession(false, 'partnerLeft');
  }

  private endSession(notifyPeer: boolean, error?: 'capture' | 'partnerLeft') {
    const s = this.session;
    if (!s) return;
    if (this.privacy) window.api.setPrivacyScreen(false, '');
    this.privacy = false;
    this.session = undefined;
    this.rejoin = error === 'partnerLeft' && s.key ? { key: s.key, canControl: s.canControl, trusted: s.trusted, until: Date.now() + 120_000 } : undefined;
    logInfo('host', `session ended (${notifyPeer ? 'disconnected here' : error ?? 'stopped'}, ${Math.round((Date.now() - s.startedAt) / 1000)} s)`);
    if (notifyPeer) s.link.send.bye(s.peerId);
    if (this.stream) {
      s.link.room.removeStream(this.stream, { target: s.peerId });
      this.stream = undefined;
    }
    clearInterval(this.encoderTimer);
    this.capture?.stop();
    this.capture = undefined;
    this.audio?.stop();
    this.audio = undefined;
    window.api.setSessionState('idle');
    this.events.onSessionChange(null, error);
    // Devices removed during the session: leave the trusted room now that it is free.
    this.syncTrustedRoom();
  }
}
