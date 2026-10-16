import { logInfo } from './log';

// Prefer H.264 for the screen: Windows and macOS encode it on the graphics chip, which is far
// faster and has less delay than the software VP8 encoder WebRTC picks by default. Applied to
// every video track this window sends, before the connection negotiates codecs.
let patched = false;

export function preferHardwareCodec() {
  if (patched || typeof RTCPeerConnection === 'undefined') return;
  patched = true;
  const nativeAddTrack = RTCPeerConnection.prototype.addTrack;
  RTCPeerConnection.prototype.addTrack = function (this: RTCPeerConnection, track: MediaStreamTrack, ...streams: MediaStream[]) {
    const sender = nativeAddTrack.call(this, track, ...streams);
    if (track.kind === 'video') {
      try {
        const transceiver = this.getTransceivers().find((t) => t.sender === sender);
        const codecs = RTCRtpReceiver.getCapabilities('video')?.codecs ?? [];
        const isH264 = (c: RTCRtpCodec) => c.mimeType.toLowerCase() === 'video/h264';
        const h264 = codecs.filter(isH264).sort((a, b) => {
          // packetization-mode=1 is what hardware encoders expect.
          const mode = (c: RTCRtpCodec) => (/packetization-mode=1/.test(c.sdpFmtpLine ?? '') ? 0 : 1);
          return mode(a) - mode(b);
        });
        if (transceiver && h264.length) transceiver.setCodecPreferences([...h264, ...codecs.filter((c) => !isH264(c))]);
      } catch (err) {
        logInfo('host', `codec preference not applied: ${err}`);
      }
    }
    return sender;
  } as typeof RTCPeerConnection.prototype.addTrack;
}

export interface EncoderStats {
  codec: string;
  encoder: string;
  hardware: boolean | undefined;
  fps: number;
  width: number;
  height: number;
  limitedBy: string;
}

// What the video encoder is doing right now: codec, hardware or software, frames, and what holds it back.
export async function readEncoderStats(sender: RTCRtpSender): Promise<EncoderStats | undefined> {
  const report = await sender.getStats();
  let out: EncoderStats | undefined;
  report.forEach((s) => {
    if (s.type !== 'outbound-rtp' || s.kind !== 'video') return;
    const codec = s.codecId ? (report.get(s.codecId) as { mimeType?: string } | undefined)?.mimeType : undefined;
    out = {
      codec: (codec ?? '?').replace('video/', ''),
      encoder: String(s.encoderImplementation ?? '?'),
      hardware: typeof s.powerEfficientEncoder === 'boolean' ? s.powerEfficientEncoder : undefined,
      fps: Math.round(s.framesPerSecond ?? 0),
      width: s.frameWidth ?? 0,
      height: s.frameHeight ?? 0,
      limitedBy: String(s.qualityLimitationReason ?? 'none'),
    };
  });
  return out;
}
