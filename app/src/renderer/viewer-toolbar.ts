import { ALL_DISPLAYS, type InputEvent, type PowerAction, type Quality } from '../../../shared/protocol';
import { t, type MessageKey } from './i18n';
import type { ViewerSession } from './viewer';
import { attachInputCapture } from './viewer-input';

const REVEAL_ZONE_PX = 70;
const HIDE_DELAY_MS = 2500;
const PAN_EDGE_PX = 48;
const PAN_SPEED = 18;
const STATS_INTERVAL_MS = 1000;
const QUALITY_KEY = 'remote-desk-quality';
const QUALITIES: Quality[] = ['auto', 'speed', 'quality', 'saver'];

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

// Set while a session toolbar is attached; the main window forwards macOS swipes here.
let swipeHandler: ((direction: string) => void) | undefined;
window.api.onSwipe((direction) => swipeHandler?.(direction));

export interface ToolbarOptions {
  partnerId: string;
  localIsMac: boolean;
  onDisconnect(): void;
  // Favorites: computers this device connects to without a password.
  isFavorite(): boolean;
  removeFavorite(): void;
  // Send the favorite request right away (chosen from the recent list before connecting).
  requestFavorite?: boolean;
  // The remote computer's sound: on or muted here; the choice is kept for next time.
  audio: boolean;
  onAudioChange(enabled: boolean): void;
  // A power action was sent (restart/shutdown: the app keeps trying to reconnect for a while).
  onPower?(action: PowerAction): void;
}

const FAVORITE_TIMEOUT_MS = 75_000;

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

  // Input capture: off in local view-only mode or when the host disabled control.
  let detachInput: (() => void) | undefined;
  let viewOnly = false;
  const syncInput = () => {
    const enabled = !viewOnly && session.canControl;
    if (enabled && !detachInput) detachInput = attachInputCapture(video, session.sendInput, options.localIsMac, session.hostPlatform === 'darwin');
    if (!enabled && detachInput) {
      detachInput();
      detachInput = undefined;
    }
    $('tool-viewonly').classList.toggle('active', !enabled);
    $('control-notice').hidden = session.canControl;
  };
  session.onControlChange = syncInput;
  onClick('tool-viewonly', () => {
    viewOnly = !viewOnly;
    syncInput();
  });
  syncInput();
  cleanups.push(() => {
    detachInput?.();
    session.onControlChange = undefined;
    $('control-notice').hidden = true;
  });

  // Fit to window / original size with edge panning.
  let original = false;
  // The last chosen quality is kept for the next sessions.
  let quality: Quality = 'auto';
  try {
    const saved = localStorage.getItem(QUALITY_KEY) as Quality | null;
    if (saved && QUALITIES.includes(saved)) quality = saved;
  } catch {
    // storage unavailable
  }
  if (quality !== 'auto') session.sendControl({ quality });
  const applyScale = () => {
    stage.classList.toggle('original', original);
    $('tool-scale').classList.toggle('active', original);
    $('tool-scale').title = t(original ? 'toolbar.fit' : 'toolbar.original');
    // Show the remote screen pixel for pixel, even when the stream is downscaled.
    const dpr = window.devicePixelRatio || 1;
    const width = session.screen?.width ?? video.videoWidth;
    const height = session.screen?.height ?? video.videoHeight;
    video.style.width = original && width ? `${width / dpr}px` : '';
    video.style.height = original && height ? `${height / dpr}px` : '';
  };
  onClick('tool-scale', () => {
    original = !original;
    if (original && zoomIndex > 0) {
      zoomIndex = 0;
      applyZoom();
    }
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

  // Three-finger swipes become the host's own gestures: overview, desktop, switch desktops.
  const SWIPES: Record<string, { mac: InputEvent; win: InputEvent }> = {
    up: { mac: combo('up', 'control'), win: combo('tab', 'command') },
    down: { mac: combo('down', 'control'), win: combo('d', 'command') },
    left: { mac: combo('right', 'control'), win: combo('right', 'control', 'command') },
    right: { mac: combo('left', 'control'), win: combo('left', 'control', 'command') },
  };
  swipeHandler = (direction) => {
    const action = SWIPES[direction];
    if (action && detachInput) session.sendInput(session.hostPlatform === 'darwin' ? action.mac : action.win);
  };
  cleanups.push(() => (swipeHandler = undefined));

  // Smart zoom: magnify the remote screen and let the view follow your mouse, so text stays readable
  // on a small display. Levels: off, 1.5×, 2×.
  const ZOOMS = [1, 1.5, 2];
  let zoomIndex = 0;
  const target = { x: 0.5, y: 0.5 };
  let zoomFrame = 0;
  const followMouse = () => {
    zoomFrame = 0;
    const maxX = stage.scrollWidth - stage.clientWidth;
    const maxY = stage.scrollHeight - stage.clientHeight;
    const dx = target.x * maxX - stage.scrollLeft;
    const dy = target.y * maxY - stage.scrollTop;
    stage.scrollLeft += dx * 0.18;
    stage.scrollTop += dy * 0.18;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) zoomFrame = requestAnimationFrame(followMouse);
  };
  const applyZoom = () => {
    const zoom = ZOOMS[zoomIndex];
    $('tool-zoom').classList.toggle('active', zoom > 1);
    $('zoom-level').textContent = zoom > 1 ? `${zoom}×` : '';
    $('tool-zoom').title = t(zoom > 1 ? 'toolbar.zoomOff' : 'toolbar.zoom');
    if (zoom === 1) {
      if (!original) {
        video.style.width = video.style.height = video.style.marginTop = '';
      }
      return;
    }
    const vw = video.videoWidth || 16;
    const vh = video.videoHeight || 9;
    const fit = Math.min(stage.clientWidth / vw, stage.clientHeight / vh);
    const w = vw * fit * zoom;
    const h = vh * fit * zoom;
    video.style.width = `${w}px`;
    video.style.height = `${h}px`;
    video.style.marginTop = `${Math.max(0, (stage.clientHeight - h) / 2)}px`;
    if (!zoomFrame) zoomFrame = requestAnimationFrame(followMouse);
  };
  onClick('tool-zoom', () => {
    zoomIndex = (zoomIndex + 1) % ZOOMS.length;
    if (zoomIndex > 0 && original) {
      original = false;
      applyScale();
    }
    applyZoom();
  });
  listen(stage, 'mousemove', (e: MouseEvent) => {
    if (zoomIndex === 0) return;
    const rect = stage.getBoundingClientRect();
    target.x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    target.y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    if (!zoomFrame) zoomFrame = requestAnimationFrame(followMouse);
  });
  listen(window, 'resize', () => zoomIndex > 0 && applyZoom());
  listen(video, 'resize', () => zoomIndex > 0 && applyZoom());
  cleanups.push(() => {
    cancelAnimationFrame(zoomFrame);
    zoomIndex = 0;
    applyZoom();
  });

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
  const menus = ['menu-monitor', 'menu-quality', 'menu-keys', 'menu-power'];
  const closeMenus = () => menus.forEach((id) => ($(id).hidden = true));
  const toggleMenu = (id: string) => {
    const open = $(id).hidden;
    closeMenus();
    $(id).hidden = !open;
  };
  listen($('tool-monitor'), 'click', () => toggleMenu('menu-monitor'));
  listen($('tool-quality'), 'click', () => toggleMenu('menu-quality'));
  listen($('tool-keys'), 'click', () => toggleMenu('menu-keys'));
  listen($('tool-power'), 'click', () => toggleMenu('menu-power'));
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
      try {
        localStorage.setItem(QUALITY_KEY, quality);
      } catch {
        // storage unavailable
      }
      renderQuality();
      applyScale();
      closeMenus();
      video.focus();
    });
  }
  renderQuality();

  // Host monitors: one at a time or all side by side; the choice is remembered per computer.
  const viewKey = `remote-desk-view:${options.partnerId}`;
  const chips = $('display-chips');
  let restored = false;
  const chooseView = (view: string) => {
    try {
      localStorage.setItem(viewKey, view);
    } catch {
      // storage unavailable
    }
    session.sendControl({ view });
    closeMenus();
    video.focus();
  };
  const monitorName = (index: number, primary: boolean) =>
    t(primary ? 'display.primary' : 'display.number', { n: String(index + 1) });
  const renderMonitors = () => {
    const layout = session.layout;
    const displays = layout?.displays ?? [];
    $('monitor-tools').hidden = displays.length < 2;
    const menu = $('menu-monitor');
    menu.replaceChildren();
    if (!layout || displays.length < 2) return;
    const add = (label: string, view: string) => {
      const button = document.createElement('button');
      button.textContent = label;
      button.classList.toggle('selected', layout.view === view);
      button.addEventListener('click', () => chooseView(view));
      menu.append(button);
    };
    displays.forEach((d, i) => add(monitorName(i, d.primary), d.id));
    add(t('display.all'), ALL_DISPLAYS);
  };
  // In the side-by-side view each monitor gets a label that switches to it alone.
  let chipsFrame = 0;
  const placeChips = () => {
    chipsFrame = 0;
    const layout = session.layout;
    chips.replaceChildren();
    if (layout?.view !== ALL_DISPLAYS || !video.videoWidth) return;
    const box = video.getBoundingClientRect();
    const scale = Math.min(box.width / video.videoWidth, box.height / video.videoHeight);
    const picture = {
      x: box.left + (box.width - video.videoWidth * scale) / 2,
      y: box.top + (box.height - video.videoHeight * scale) / 2,
      width: video.videoWidth * scale,
      height: video.videoHeight * scale,
    };
    const left = Math.min(...layout.displays.map((d) => d.x));
    const top = Math.min(...layout.displays.map((d) => d.y));
    const unionWidth = Math.max(...layout.displays.map((d) => d.x + d.width)) - left;
    const unionHeight = Math.max(...layout.displays.map((d) => d.y + d.height)) - top;
    const visible = stage.getBoundingClientRect();
    layout.displays.forEach((d, i) => {
      const x = picture.x + ((d.x - left + d.width / 2) / unionWidth) * picture.width;
      const y = picture.y + ((d.y - top) / unionHeight) * picture.height;
      if (x < visible.left || x > visible.right || y < visible.top || y > visible.bottom) return;
      const chip = document.createElement('button');
      chip.className = 'display-chip';
      chip.textContent = t('display.only', { name: monitorName(i, d.primary) });
      chip.style.left = `${x}px`;
      chip.style.top = `${Math.max(y, visible.top) + 8}px`;
      chip.addEventListener('click', () => chooseView(d.id));
      chips.append(chip);
    });
  };
  const schedulePlaceChips = () => {
    if (!chipsFrame) chipsFrame = requestAnimationFrame(placeChips);
  };
  session.onLayout = () => {
    renderMonitors();
    applyScale();
    schedulePlaceChips();
    const layout = session.layout;
    if (restored || !layout) return;
    restored = true;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(viewKey);
    } catch {
      // storage unavailable
    }
    const available =
      saved === ALL_DISPLAYS ? layout.displays.length > 1 : layout.displays.some((d) => d.id === saved);
    if (saved && saved !== layout.view && available) session.sendControl({ view: saved });
  };
  if (session.layout) session.onLayout();
  listen(video, 'resize', schedulePlaceChips);
  listen(window, 'resize', schedulePlaceChips);
  listen(stage, 'scroll', schedulePlaceChips);
  listen($('tool-scale'), 'click', schedulePlaceChips);
  cleanups.push(() => {
    cancelAnimationFrame(chipsFrame);
    chips.replaceChildren();
    $('monitor-tools').hidden = true;
    session.onLayout = undefined;
  });

  // Power: lock and sleep right away; restart and shut down ask for a second click.
  const POWER_LABEL: Record<PowerAction, MessageKey> = {
    lock: 'power.lock', sleep: 'power.sleep', restart: 'power.restart', shutdown: 'power.shutdown',
  };
  let armed: PowerAction | undefined;
  const resetPowerLabels = () => {
    armed = undefined;
    for (const b of document.querySelectorAll<HTMLElement>('[data-power]')) {
      b.textContent = t(POWER_LABEL[b.dataset.power as PowerAction]);
      b.classList.remove('danger');
    }
  };
  for (const button of document.querySelectorAll<HTMLElement>('[data-power]')) {
    listen(button, 'click', () => {
      const action = button.dataset.power as PowerAction;
      if ((action === 'restart' || action === 'shutdown') && armed !== action) {
        resetPowerLabels();
        armed = action;
        button.textContent = t(action === 'restart' ? 'power.confirmRestart' : 'power.confirmShutdown');
        button.classList.add('danger');
        return;
      }
      resetPowerLabels();
      closeMenus();
      session.power(action);
      options.onPower?.(action);
      showTransfer(t(`power.sent.${action}` as MessageKey), false, 6000);
    });
  }
  listen($('tool-power'), 'click', resetPowerLabels);
  $('tool-power').hidden = !session.canControl;
  const powerControl = session.onControlChange;
  session.onControlChange = (can) => {
    powerControl?.(can);
    $('tool-power').hidden = !can;
  };

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

  // Favorite star: ask the host, which has to approve it there.
  const star = $('tool-favorite');
  let favorite: 'none' | 'pending' | 'yes' = options.isFavorite() ? 'yes' : 'none';
  let favoriteTimer = 0;
  const renderStar = () => {
    star.classList.toggle('favorite-on', favorite === 'yes');
    star.classList.toggle('pending', favorite === 'pending');
    star.title = t(favorite === 'yes' ? 'toolbar.unfavorite' : favorite === 'pending' ? 'favorite.pending' : 'toolbar.favorite');
  };
  const askFavorite = () => {
    favorite = 'pending';
    renderStar();
    session.requestFavorite();
    showTransfer(t('favorite.pending'), false, 15000);
    clearTimeout(favoriteTimer);
    favoriteTimer = window.setTimeout(() => {
      if (favorite !== 'pending') return;
      favorite = 'none';
      renderStar();
      showTransfer(t('favorite.noAnswer'), true, 6000);
    }, FAVORITE_TIMEOUT_MS);
  };
  session.onFavorite = (result) => {
    clearTimeout(favoriteTimer);
    const was = favorite;
    favorite = result === 'added' ? 'yes' : 'none';
    renderStar();
    if (result === 'added' && was !== 'yes') showTransfer(t('favorite.added'), false, 5000);
    if (result === 'saveFailed') showTransfer(t('favorite.saveFailed'), true, 8000);
    if (result === 'declined' && was === 'pending') showTransfer(t('favorite.declined'), true, 6000);
  };
  onClick('tool-favorite', () => {
    if (favorite === 'pending') return;
    if (favorite === 'yes') {
      options.removeFavorite();
      favorite = 'none';
      renderStar();
      showTransfer(t('favorite.removed'), false, 4000);
    } else askFavorite();
  });
  renderStar();
  cleanups.push(() => {
    clearTimeout(favoriteTimer);
    session.onFavorite = undefined;
  });

  // Privacy screen: black out the remote computer's monitors while you work on it.
  const privacyButton = $('tool-privacy');
  const renderPrivacy = () => {
    privacyButton.hidden = !session.privacyAvailable;
    privacyButton.classList.toggle('active', session.privacy);
    privacyButton.title = t(session.privacy ? 'toolbar.privacyOff' : 'toolbar.privacyOn');
  };
  let privacyWanted = false;
  session.onPrivacyChange = (on) => {
    renderPrivacy();
    if (on) showTransfer(t('privacy.on'), false, 4000);
    else if (privacyWanted) showTransfer(t('privacy.lifted'), true, 8000);
    privacyWanted = on;
  };
  onClick('tool-privacy', () => {
    privacyWanted = !session.privacy;
    session.sendControl({ privacy: privacyWanted });
    if (!privacyWanted) showTransfer(t('privacy.off'), false, 3000);
  });
  renderPrivacy();
  cleanups.push(() => {
    session.onPrivacyChange = undefined;
    privacyButton.hidden = true;
  });

  // Remote sound: play it here or mute it. Muting only affects this computer.
  const renderAudio = () => {
    const on = !video.muted;
    $('tool-audio').classList.toggle('muted', !on);
    $('tool-audio').title = t(on ? 'toolbar.mute' : 'toolbar.unmute');
  };
  video.muted = !options.audio;
  onClick('tool-audio', () => {
    video.muted = !video.muted;
    options.onAudioChange(!video.muted);
    renderAudio();
  });
  renderAudio();
  cleanups.push(() => (video.muted = true));

  // Shared clipboard on/off for this session.
  onClick('tool-clipboard', () => {
    session.clipboardEnabled = !session.clipboardEnabled;
    $('tool-clipboard').classList.toggle('active', session.clipboardEnabled);
  });
  cleanups.push(() => $('tool-clipboard').classList.add('active'));

  // File transfer: toolbar button or drag and drop onto the remote screen.
  const transfer = $('transfer-status');
  let transferTimer = 0;
  const showTransfer = (text: string, error = false, hideAfter = 0) => {
    clearTimeout(transferTimer);
    transfer.textContent = text;
    transfer.classList.toggle('error', error);
    transfer.hidden = false;
    reveal();
    if (hideAfter) transferTimer = window.setTimeout(() => (transfer.hidden = true), hideAfter);
  };
  let sending = Promise.resolve();
  const sendFiles = (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      sending = sending.then(async () => {
        if (!session.canControl) return showTransfer(t('files.notAllowed'), true, 4000);
        const name = f.name;
        showTransfer(t('files.sending', { name, percent: '0' }));
        const result = await session.sendFile(f, (p) =>
          showTransfer(t('files.sending', { name, percent: String(Math.round(p * 100)) })),
        );
        if (result === 'sent') showTransfer(t('files.sent', { name }), false, 4000);
        else showTransfer(t(result === 'tooLarge' ? 'files.tooLarge' : 'files.rejected', { name }), true, 6000);
      });
    }
  };
  const fileInput = $<HTMLInputElement>('file-input');
  onClick('tool-file', () => fileInput.click());
  listen(fileInput, 'change', () => {
    if (fileInput.files?.length) sendFiles(fileInput.files);
    fileInput.value = '';
  });
  const overlay = $('drop-overlay');
  let dragDepth = 0;
  listen(stage, 'dragenter', (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    dragDepth++;
    $('drop-text').textContent = t(session.canControl ? 'files.drop' : 'files.notAllowed');
    overlay.hidden = false;
  });
  listen(stage, 'dragover', (e: DragEvent) => e.preventDefault());
  listen(stage, 'dragleave', () => {
    if (--dragDepth <= 0) overlay.hidden = true;
  });
  listen(stage, 'drop', (e: DragEvent) => {
    e.preventDefault();
    dragDepth = 0;
    overlay.hidden = true;
    if (e.dataTransfer?.files.length) sendFiles(e.dataTransfer.files);
  });
  cleanups.push(() => {
    clearTimeout(transferTimer);
    transfer.hidden = true;
    overlay.hidden = true;
  });

  // Downloading from the remote computer: files copied there, or picked on its screen.
  const formatSize = (bytes: number) =>
    bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
  const offerPill = $('file-offer');
  let offeredIds: string[] = [];
  let savedPath: string | null = null;
  session.onOffer = (offers) => {
    offeredIds = offers.map((o) => o.id);
    const size = formatSize(offers.reduce((sum, o) => sum + o.size, 0));
    $('file-offer-text').textContent =
      offers.length === 1
        ? t('files.offerOne', { name: offers[0].name, size })
        : t('files.offerMany', { count: String(offers.length), size });
    offerPill.hidden = false;
    reveal();
  };
  onClick('file-offer-get', () => {
    offerPill.hidden = true;
    if (offeredIds.length) session.requestFiles({ ids: offeredIds });
  });
  onClick('tool-download', () => {
    if (!session.canControl) return showTransfer(t('files.notAllowed'), true, 4000);
    session.requestFiles({ pick: true });
    showTransfer(t('files.pickHint'), false, 15000);
  });
  session.onDownloadProgress = (name, fraction) =>
    showTransfer(t('files.receiving', { name, percent: String(Math.round(fraction * 100)) }));
  session.onDownloaded = (name, path) => {
    savedPath = path;
    if (path) showTransfer(t('files.saved', { name }), false, 10000);
    else showTransfer(t('files.saveFailed', { name }), true, 8000);
    transfer.classList.toggle('clickable', Boolean(path));
  };
  listen(transfer, 'click', () => {
    if (savedPath && transfer.classList.contains('clickable')) window.api.revealFile(savedPath);
  });
  cleanups.push(() => {
    offerPill.hidden = true;
    transfer.classList.remove('clickable');
    session.onOffer = session.onDownloadProgress = session.onDownloaded = undefined;
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
    let size: string | undefined;
    let relayed = false;
    let bitrate: number | undefined;
    let pairId: string | undefined;
    stats.forEach((s) => {
      if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
    });
    stats.forEach((s) => {
      if (s.type === 'inbound-rtp' && s.kind === 'video') {
        fps = s.framesPerSecond;
        if (s.frameWidth && s.frameHeight) size = `${s.frameWidth}×${s.frameHeight}`;
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
    // What actually arrives: resolution and frame rate after the sender adapted to the network.
    const parts = [
      rtt !== undefined ? `${rtt} ms` : undefined,
      size,
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

  // Requested from the recent list: ask as soon as the session is up.
  if (options.requestFavorite && favorite === 'none') askFavorite();

  return () => {
    for (const fn of cleanups.reverse()) fn();
    for (const id of ['tool-viewonly', 'tool-pin', 'tool-scale']) $(id).classList.remove('active');
  };
}
