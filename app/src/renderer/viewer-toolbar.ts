import { QUALITY_SCALE, type InputEvent, type Quality } from '../../../shared/protocol';
import { t, type MessageKey } from './i18n';
import type { ViewerSession } from './viewer';
import { attachInputCapture } from './viewer-input';

const REVEAL_ZONE_PX = 70;
const HIDE_DELAY_MS = 2500;
const PAN_EDGE_PX = 48;
const PAN_SPEED = 18;
const STATS_INTERVAL_MS = 1000;

type Shortcut = { label: MessageKey; keys: string; combo: Extract<InputEvent, { t: 'combo' }> };

const combo = (key: string, ...modifiers: string[]): Shortcut['combo'] => ({ t: 'combo', key, modifiers });

const MAC_SHORTCUTS: Shortcut[] = [
  { label: 'keys.appSwitcher', keys: '⌘ Tab', combo: combo('tab', 'command') },
  { label: 'keys.spotlight', keys: '⌘ Space', combo: combo('space', 'command') },
  { label: 'keys.missionControl', keys: '⌃ ↑', combo: combo('up', 'control') },
  { label: 'keys.quitApp', keys: '⌘ Q', combo: combo('q', 'command') },
  { label: 'keys.forceQuit', keys: '⌥ ⌘ Esc', combo: combo('escape', 'command', 'alt') },
];

const WINDOWS_SHORTCUTS: Shortcut[] = [
  { label: 'keys.appSwitcher', keys: 'Alt Tab', combo: combo('tab', 'alt') },
  { label: 'keys.start', keys: 'Win', combo: combo('command') },
  { label: 'keys.desktop', keys: 'Win D', combo: combo('d', 'command') },
  { label: 'keys.explorer', keys: 'Win E', combo: combo('e', 'command') },
  { label: 'keys.run', keys: 'Win R', combo: combo('r', 'command') },
  { label: 'keys.taskManager', keys: 'Ctrl Shift Esc', combo: combo('escape', 'control', 'shift') },
  { label: 'keys.closeWindow', keys: 'Alt F4', combo: combo('f4', 'alt') },
];

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface ToolbarOptions {
  partnerId: string;
  localIsMac: boolean;
  onDisconnect(): void;
}

// Floating session toolbar for the viewer; returns a cleanup function.
export function attachToolbar(session: ViewerSession, options: ToolbarOptions): () => void {
  const video = $<HTMLVideoElement>('remote-video');
  const stage = $('viewer-stage');
  const toolbar = $('toolbar');
  const cleanups: (() => void)[] = [];
  const listen = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement | Window | Document,
    type: K | string,
    handler: (e: never) => void,
    opts?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, handler as EventListener, opts);
    cleanups.push(() => target.removeEventListener(type, handler as EventListener, opts));
  };
  const onClick = (id: string, handler: () => void) =>
    listen($(id), 'click', () => {
      handler();
      video.focus();
    });

  // Input capture, paused in view-only mode.
  let detachInput: (() => void) | undefined = attachInputCapture(video, session.sendInput, options.localIsMac);
  let viewOnly = false;
  onClick('tool-viewonly', () => {
    viewOnly = !viewOnly;
    $('tool-viewonly').classList.toggle('active', viewOnly);
    if (viewOnly) {
      detachInput?.();
      detachInput = undefined;
    } else {
      detachInput = attachInputCapture(video, session.sendInput, options.localIsMac);
    }
  });
  cleanups.push(() => detachInput?.());

  // Fit to window / original size with edge panning.
  let original = false;
  let quality: Quality = 'auto';
  const applyScale = () => {
    stage.classList.toggle('original', original);
    $('tool-scale').classList.toggle('active', original);
    $('tool-scale').title = t(original ? 'toolbar.fit' : 'toolbar.original');
    // Undo the host's downscaling so "original" matches the remote screen size.
    const factor = QUALITY_SCALE[quality] / (window.devicePixelRatio || 1);
    video.style.width = original && video.videoWidth ? `${video.videoWidth * factor}px` : '';
    video.style.height = original && video.videoHeight ? `${video.videoHeight * factor}px` : '';
  };
  onClick('tool-scale', () => {
    original = !original;
    applyScale();
  });
  listen(video, 'resize', applyScale);
  cleanups.push(() => {
    original = false;
    applyScale();
  });

  let pan = { x: 0, y: 0 };
  let panFrame = 0;
  const panStep = () => {
    stage.scrollLeft += pan.x;
    stage.scrollTop += pan.y;
    panFrame = pan.x || pan.y ? requestAnimationFrame(panStep) : 0;
  };
  listen(stage, 'mousemove', (e: MouseEvent) => {
    if (!original) return;
    const rect = stage.getBoundingClientRect();
    const axis = (pos: number, start: number, size: number) =>
      pos - start < PAN_EDGE_PX ? -PAN_SPEED : start + size - pos < PAN_EDGE_PX ? PAN_SPEED : 0;
    pan = { x: axis(e.clientX, rect.left, rect.width), y: axis(e.clientY, rect.top, rect.height) };
    if ((pan.x || pan.y) && !panFrame) panFrame = requestAnimationFrame(panStep);
  });
  listen(stage, 'mouseleave', () => (pan = { x: 0, y: 0 }));
  cleanups.push(() => cancelAnimationFrame(panFrame));

  // Full screen.
  onClick('tool-fullscreen', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  });
  listen(document, 'fullscreenchange', () =>
    $('tool-fullscreen').classList.toggle('active', Boolean(document.fullscreenElement)),
  );
  cleanups.push(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
  });

  // Menus.
  const menus = ['menu-quality', 'menu-keys'];
  const closeMenus = () => menus.forEach((id) => ($(id).hidden = true));
  const toggleMenu = (id: string) => {
    const open = $(id).hidden;
    closeMenus();
    $(id).hidden = !open;
  };
  listen($('tool-quality'), 'click', () => toggleMenu('menu-quality'));
  listen($('tool-keys'), 'click', () => toggleMenu('menu-keys'));
  listen(document, 'mousedown', (e: MouseEvent) => {
    if (!(e.target as Element).closest('.tool-menu')) closeMenus();
  });
  cleanups.push(closeMenus);

  // Quality.
  const renderQuality = () => {
    for (const b of document.querySelectorAll<HTMLElement>('[data-quality]')) {
      b.classList.toggle('selected', b.dataset.quality === quality);
    }
  };
  for (const button of document.querySelectorAll<HTMLElement>('[data-quality]')) {
    listen(button, 'click', () => {
      quality = button.dataset.quality as Quality;
      session.sendControl({ quality });
      renderQuality();
      applyScale();
      closeMenus();
      video.focus();
    });
  }
  renderQuality();

  // Shortcuts for the host's platform.
  const keysMenu = $('menu-keys');
  keysMenu.replaceChildren();
  for (const shortcut of session.hostPlatform === 'darwin' ? MAC_SHORTCUTS : WINDOWS_SHORTCUTS) {
    const button = document.createElement('button');
    const label = document.createElement('span');
    label.textContent = t(shortcut.label);
    const keys = document.createElement('kbd');
    keys.textContent = shortcut.keys;
    button.append(label, keys);
    button.addEventListener('click', () => {
      session.sendInput(shortcut.combo);
      closeMenus();
      video.focus();
    });
    keysMenu.append(button);
  }

  // Screenshot of the current frame.
  onClick('tool-screenshot', () => {
    if (!video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `remote-desk-${options.partnerId}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    }, 'image/png');
  });

  // Auto-hide unless pinned, hovered or a menu is open.
  let pinned = false;
  let hideTimer = 0;
  const scheduleHide = () => {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      const menuOpen = menus.some((id) => !$(id).hidden);
      if (!pinned && !menuOpen && !toolbar.matches(':hover')) toolbar.classList.add('collapsed');
    }, HIDE_DELAY_MS);
  };
  const reveal = () => {
    toolbar.classList.remove('collapsed');
    scheduleHide();
  };
  onClick('tool-pin', () => {
    pinned = !pinned;
    $('tool-pin').classList.toggle('active', pinned);
    reveal();
  });
  listen(window, 'mousemove', (e: MouseEvent) => {
    if (e.clientY < REVEAL_ZONE_PX) reveal();
  });
  listen(toolbar, 'mouseleave', scheduleHide);
  reveal();
  cleanups.push(() => {
    clearTimeout(hideTimer);
    toolbar.classList.remove('collapsed');
  });

  onClick('viewer-disconnect', options.onDisconnect);

  // Connection stats: round-trip time, frame rate, bitrate, direct or relayed.
  let lastBytes = 0;
  let lastTime = 0;
  const statsTimer = window.setInterval(async () => {
    const pc = session.connection();
    if (!pc) return;
    const stats = await pc.getStats();
    let rtt: number | undefined;
    let fps: number | undefined;
    let relayed = false;
    let bitrate: number | undefined;
    let pairId: string | undefined;
    stats.forEach((s) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
    });
    stats.forEach((s) => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') {
        fps = s.framesPerSecond;
        if (lastTime) bitrate = ((s.bytesReceived - lastBytes) * 8) / ((s.timestamp - lastTime) / 1000);
        lastBytes = s.bytesReceived;
        lastTime = s.timestamp;
      }
      if (s.type === 'candidate-pair' && (s.id === pairId || (!pairId && s.nominated && s.state === 'succeeded'))) {
        if (s.currentRoundTripTime !== undefined) rtt = Math.round(s.currentRoundTripTime * 1000);
        const local = stats.get(s.localCandidateId);
        const remote = stats.get(s.remoteCandidateId);
        relayed = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
      }
    });
    const parts = [
      rtt !== undefined ? `${rtt} ms` : undefined,
      fps !== undefined ? `${Math.round(fps)} fps` : undefined,
      bitrate !== undefined ? `${(bitrate / 1_000_000).toFixed(1)} Mb/s` : undefined,
      t(relayed ? 'conn.relay' : 'conn.direct'),
    ];
    $('conn-text').textContent = parts.filter(Boolean).join(' · ');
    const info = $('conn-info');
    info.classList.toggle('good', rtt !== undefined && rtt < 80);
    info.classList.toggle('fair', rtt !== undefined && rtt >= 80 && rtt < 200);
    info.classList.toggle('poor', rtt !== undefined && rtt >= 200);
  }, STATS_INTERVAL_MS);
  cleanups.push(() => {
    clearInterval(statsTimer);
    $('conn-text').textContent = '…';
  });

  video.focus();

  return () => {
    for (const fn of cleanups.reverse()) fn();
    for (const id of ['tool-viewonly', 'tool-pin', 'tool-scale']) $(id).classList.remove('active');
  };
}
