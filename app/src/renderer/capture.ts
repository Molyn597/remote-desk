import { ALL_DISPLAYS, type DisplayInfo } from '../../../shared/protocol';
import { logInfo } from './log';

// Side-by-side picture limits: big enough to read, small enough to encode in real time.
const ALL_MAX_WIDTH = 3840;
const ALL_MAX_HEIGHT = 2160;
const ALL_FPS = 30;

export interface Capture {
  track: MediaStreamTrack;
  width: number;
  height: number;
  stop(): void;
}

async function captureDisplay(id: string): Promise<MediaStreamTrack> {
  await window.api.setCaptureTarget(id);
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 60, max: 60 } },
    audio: false,
  });
  return stream.getVideoTracks()[0];
}

// The computer's sound, captured once per session and kept while monitors are switched.
export async function captureAudio(): Promise<MediaStreamTrack | undefined> {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
    stream.getVideoTracks().forEach((t) => t.stop());
    const track = stream.getAudioTracks()[0];
    if (!track) logInfo('host', 'system sound: the system returned no audio track');
    return track;
  } catch (err) {
    // On Windows this usually means the default output runs as surround sound (e.g. 7.1 headphones).
    const hint = err instanceof Error && err.name === 'NotReadableError' ? ' (often a sound output set to surround/7.1)' : '';
    logInfo('host', `system sound unavailable: ${err instanceof Error ? `${err.name}: ${err.message}` : err}${hint}`);
    return undefined;
  }
}

const size = (track: MediaStreamTrack) => {
  const { width = 0, height = 0 } = track.getSettings();
  return { width, height };
};

// Captures one monitor, or all of them drawn into one picture as they are arranged.
export async function captureView(view: string, displays: DisplayInfo[]): Promise<Capture> {
  if (view !== ALL_DISPLAYS || displays.length < 2) {
    const id = displays.find((d) => d.id === view)?.id ?? displays.find((d) => d.primary)?.id ?? '';
    const track = await captureDisplay(id);
    return { track, ...size(track), stop: () => track.stop() };
  }

  const tracks: MediaStreamTrack[] = [];
  try {
    for (const d of displays) tracks.push(await captureDisplay(d.id));
  } catch (err) {
    tracks.forEach((t) => t.stop());
    throw err;
  }
  const videos = await Promise.all(
    tracks.map(async (track) => {
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = new MediaStream([track]);
      await video.play();
      return video;
    }),
  );

  const left = Math.min(...displays.map((d) => d.x));
  const top = Math.min(...displays.map((d) => d.y));
  const unionWidth = Math.max(...displays.map((d) => d.x + d.width)) - left;
  const unionHeight = Math.max(...displays.map((d) => d.y + d.height)) - top;
  // Keep the sharpest monitor at its own resolution unless that gets too big.
  const density = Math.max(...displays.map((d, i) => size(tracks[i]).width / d.width || 1));
  const scale = Math.min(density, ALL_MAX_WIDTH / unionWidth, ALL_MAX_HEIGHT / unionHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round((unionWidth * scale) / 2) * 2;
  canvas.height = Math.round((unionHeight * scale) / 2) * 2;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const draw = () => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    displays.forEach((d, i) => {
      ctx.drawImage(videos[i], (d.x - left) * scale, (d.y - top) * scale, d.width * scale, d.height * scale);
    });
  };
  draw();
  const timer = setInterval(draw, 1000 / ALL_FPS);
  const track = canvas.captureStream(ALL_FPS).getVideoTracks()[0];
  return {
    track,
    width: canvas.width,
    height: canvas.height,
    stop: () => {
      clearInterval(timer);
      track.stop();
      tracks.forEach((t) => t.stop());
      videos.forEach((v) => (v.srcObject = null));
    },
  };
}
