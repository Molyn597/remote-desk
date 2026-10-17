import type { Api, PermissionKind, UpdateState } from '../preload/api';
import { parseChangelog, renderRelease, type Release } from './changelog';
import { renderHelp } from './help';
import { captureErrors, logError, logInfo } from './log';
import { enhanceSelect, refreshSelects } from './select';
import { Host, type HostSession, type Visitor } from './host';
import { loadIdentity, openSecret, sealSecret } from './identity';
import { currentLanguage, setLanguage, t, type MessageKey } from './i18n';
import { isOnline } from './network';
import {
  addHistory,
  addRecent,
  clearHistory,
  finishHistory,
  loadHistory,
  loadHostId,
  loadMyDevices,
  loadRecent,
  loadSettings,
  loadTrusted,
  removeMyDevice,
  removeRecent,
  removeTrusted,
  resetTrust,
  saveMyDevice,
  saveSettings,
  touchMyDevice,
  type MyDevice,
  type Settings,
} from './settings';
import { Viewer, type ViewerError, type ViewerSession } from './viewer';
import { attachToolbar } from './viewer-toolbar';

declare global {
  interface Window {
    api: Api;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const STATUS_POLL_MS = 2000;

type Page = 'home' | 'settings' | 'permissions' | 'news' | 'help';

captureErrors();
const config = await window.api.getConfig();
const isMac = config.platform === 'darwin';
const video = $<HTMLVideoElement>('remote-video');
const hostId = loadHostId();
const identity = await loadIdentity();

let settings = loadSettings();
let password = generatePassword();
let detachToolbar: (() => void) | undefined;
let viewerSession: ViewerSession | undefined;
let viewerBusy = false;

function generatePassword(length = 8): string {
  // 32 symbols divide 256 evenly, so the modulo is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

const formatId = (id: string) => id.replace(/(\d{3})(?=\d)/g, '$1 ');

// Motion

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Panels and cards land one after another. They are hidden right away and start moving two frames
// later, once the page has been laid out and painted, so the first frames don't stutter (Windows).
function animateIn(elements: Iterable<Element>) {
  const nodes = [...elements] as HTMLElement[];
  nodes.forEach((node, i) => {
    node.classList.remove('anim-in');
    node.classList.add('anim-prep');
    node.style.setProperty('--i', String(i));
  });
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      for (const node of nodes) {
        node.classList.remove('anim-prep');
        node.classList.add('anim-in');
        node.addEventListener('animationend', () => node.classList.remove('anim-in'), { once: true });
      }
    }),
  );
}

// Milliseconds until the last part of an animateIn() has landed (0.5 s each, 50 ms apart).
const settleTime = (count: number) => (reduceMotion() ? 0 : 500 + Math.max(0, count - 1) * 50);

// Notes in the diagnostics log when a page switch drew slowly (frames over 34 ms), to find stutter.
function watchFrames(label: string, durationMs: number) {
  let last = performance.now();
  const end = last + durationMs;
  let slow = 0;
  let longest = 0;
  const frame = (now: number) => {
    const gap = now - last;
    last = now;
    if (gap > 34) {
      slow++;
      longest = Math.max(longest, gap);
    }
    if (now < end) requestAnimationFrame(frame);
    else if (slow) logInfo('motion', `${label}: ${slow} slow frame(s), longest ${Math.round(longest)} ms`);
  };
  requestAnimationFrame(frame);
}

const pageParts = (page: Element) =>
  page.querySelectorAll(':scope > .page-header, :scope .card, :scope > .panel, :scope .settings-group, :scope .permission-row, :scope .help > *');

// Characters roll like a departures board before settling on the new text.
function rollText(el: HTMLElement, text: string) {
  if (reduceMotion()) {
    el.textContent = text;
    return;
  }
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  const start = performance.now();
  const frame = () => {
    const elapsed = performance.now() - start;
    const settled = Math.floor(elapsed / 45);
    el.textContent = [...text]
      .map((c, i) => (i < settled ? c : chars[Math.floor(Math.random() * chars.length)]))
      .join('');
    if (settled < text.length) requestAnimationFrame(frame);
    else el.textContent = text;
  };
  frame();
}

// Navigation

let currentPage: Page = 'home';
// Update track ('stable', 'beta' or a version) and the published versions to choose from.
let updateTrack = 'stable';
let releaseList: { version: string; prerelease: boolean }[] = [];

function showPage(page: Page) {
  for (const p of ['home', 'settings', 'permissions', 'news', 'help'] as const) $(`page-${p}`).hidden = p !== page;
  let settled = 0;
  if (page !== currentPage) {
    const parts = pageParts($(`page-${page}`));
    animateIn(parts);
    settled = settleTime(parts.length);
    watchFrames(`page ${page}`, settled + 100);
  }
  currentPage = page;
  for (const item of document.querySelectorAll<HTMLElement>('.nav-item')) {
    item.classList.toggle('active', item.dataset.nav === page);
  }
  if (page === 'settings') {
    fillSettingsForm();
    // Building the history and the log is heavy; doing it mid-animation made the page stutter.
    setTimeout(() => {
      if (currentPage !== 'settings') return;
      renderHistory();
      void renderLog();
    }, settled);
  }
  if (page === 'permissions') void refreshPermissions();
  if (page === 'help') renderHelp($('help-content'));
  if (page === 'news') setTimeout(() => void loadReleases(), settled);
}

for (const el of document.querySelectorAll<HTMLElement>('[data-nav]')) {
  el.addEventListener('click', () => showPage(el.dataset.nav as Page));
}

// Status

function renderNetwork() {
  $('network-name').textContent = t(settings.serverUrl ? 'network.own' : 'network.public');
  $('network-detail').textContent = settings.serverUrl || 'Nostr';
}

function refreshStatus() {
  const online = isOnline(settings);
  $('status-pill').classList.toggle('online', online);
  $('status-text').textContent = t(online ? 'status.online' : 'status.offline');
  document.querySelector('.network-card')!.classList.toggle('status-off', !online);
}

// Theme: explicit choice, or follow the system until the user picks one.

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function applyTheme() {
  const dark = settings.theme === 'auto' ? darkQuery.matches : settings.theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  // The remote screen is shown on black, so the native window buttons go dark too.
  window.api.setTheme(dark || !$('viewer').hidden ? 'dark' : 'light');
}

darkQuery.addEventListener('change', applyTheme);
$('theme-toggle').addEventListener('click', () => {
  settings = { ...settings, theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark' };
  saveSettings(settings);
  // Colours glide over instead of flipping.
  document.documentElement.classList.add('theme-anim');
  applyTheme();
  setTimeout(() => document.documentElement.classList.remove('theme-anim'), 400);
});

// Host

function describeVisitor(visitor: Visitor): string {
  const name = visitor.name ? `„${visitor.name}“` : t('visitor.unknown');
  return visitor.id ? t('visitor.withId', { name, id: formatId(visitor.id) }) : name;
}

function showSessionPanel(session: HostSession | null) {
  window.api.showSessionPanel(
    session && {
      title: t('panel.title', { who: describeVisitor(session) }),
      mode:
        t(!session.canControl ? 'panel.modeView' : session.paused ? 'panel.modePaused' : 'panel.modeControl') +
        (session.trusted ? ` · ${t('panel.trusted')}` : ''),
      startedAt: session.startedAt,
      canControl: session.canControl,
      paused: session.paused,
      pauseLabel: t('panel.pause'),
      resumeLabel: t('panel.resume'),
      disconnectLabel: t('session.disconnect'),
    },
  );
}

const host = new Host(config.platform, {
  confirm: (visitor) =>
    window.api.confirmConnection({
      title: t('confirm.title'),
      detail: t('confirm.detail', { who: describeVisitor(visitor) }),
      allowControl: t('confirm.allowControl'),
      allowView: t('confirm.allowView'),
      deny: t('confirm.deny'),
      remember: visitor.key ? t('confirm.remember') : undefined,
    }),
  // Input from the viewer is blocked while this is open, so only someone here can approve.
  confirmFavorite: async (visitor) =>
    (
      await window.api.confirmConnection({
        title: t('favorite.requestTitle'),
        detail: t('favorite.requestDetail', { who: describeVisitor(visitor) }),
        allowControl: t('confirm.allowControl'),
        allowView: t('confirm.allowView'),
        deny: t('confirm.deny'),
      })
    ).choice,
  pickerTitle: () => t('files.pickTitle'),
  privacyMessage: (visitor) => t('privacy.overlay', { who: describeVisitor(visitor) }),
  onPowerAction: (visitor, action) => {
    new Notification(t('power.hostNotice', { who: describeVisitor(visitor), action: t(`power.${action}` as MessageKey).toLowerCase() }));
  },
  onFileSent: (name) => {
    new Notification(t('files.sentTitle'), { body: t('files.sentBody', { name }) });
  },
  onFileReceived: (name, path) => {
    const notice = new Notification(t(path ? 'files.receivedTitle' : 'files.receivedFailed', { name }), {
      body: path ? t('files.receivedBody', { name }) : '',
    });
    if (path) notice.onclick = () => window.api.revealFile(path);
  },
  onSessionChange: (session, error) => {
    // A new session: remember it and say so, also when this computer is in the background.
    if (session && !hostSession) {
      addHistory({ at: session.startedAt, id: session.id, name: session.name, trusted: session.trusted, control: session.canControl });
      new Notification(t('history.notifyTitle'), {
        body: t(session.canControl ? 'history.notifyControl' : 'history.notifyView', { who: describeVisitor(session) }),
      });
    }
    if (!session && hostSession) finishHistory(hostSession.startedAt);
    hostSession = session;
    sendBackground();
    $('host-banner').hidden = !session;
    showSessionPanel(session);
    if (error === 'capture') {
      showPage('home');
      setStatus(t('msg.hostCapture'), true, true);
    }
  },
});

window.api.onPrivacyOff(() => host.privacyLifted());
host.setPrivacyAllowed(settings.allowPrivacy);

window.api.onSessionAction((action) => {
  if (action === 'disconnect') host.disconnect();
  else host.setPaused(action === 'pause');
});

function restartHost() {
  void host.start(settings, hostId, password);
}

$('my-id').textContent = formatId(hostId);
$('my-password').textContent = password;
$('new-password').addEventListener('click', () => {
  if (host.active) return;
  password = generatePassword();
  rollText($('my-password'), password);
  const button = $('new-password');
  button.classList.remove('spinning');
  void button.offsetWidth;
  button.classList.add('spinning');
  restartHost();
});
$('host-disconnect').addEventListener('click', () => host.disconnect());

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', () => {
    window.api.copyText($(button.dataset.copy!).textContent!.replace(/\s/g, ''));
    // The copy icon turns into a tick for a moment.
    const icon = button.dataset.icon ?? button.innerHTML;
    button.dataset.icon = icon;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>';
    button.classList.add('copied');
    button.title = t('action.copied');
    clearTimeout(Number(button.dataset.timer));
    button.dataset.timer = String(
      setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = icon;
        button.title = t('action.copy');
      }, 1500),
    );
  });
}

// Viewer

const VIEWER_ERRORS: Record<ViewerError, MessageKey> = {
  wrongPassword: 'msg.wrongPassword',
  notFound: 'msg.notFound',
  noResponse: 'msg.noResponse',
  declined: 'msg.declined',
  busy: 'msg.busy',
  capture: 'msg.capture',
  partnerLeft: 'msg.partnerLeft',
  closed: 'msg.partnerLeft',
  untrusted: 'msg.untrusted',
};

let viewerTrusted = false;
// Set by the star in the recent list: ask for favorite once this connection is up.
let favoriteAfterConnect = '';

let viewerPartnerId = '';

const viewer = new Viewer(config.platform, {
  onStatus: (status) => setStatus(t(status === 'searching' ? 'msg.searching' : 'msg.waiting')),
  onConnected: (session) => {
    if (reconnecting) logInfo('viewer', 'reconnected');
    reconnecting = false;
    userEnded = false;
    $('reconnect').hidden = true;
    addRecent(viewerPartnerId);
    renderRecent();
    if (viewerTrusted) {
      touchMyDevice(viewerPartnerId);
      renderMyDevices();
    }
    setStatus('');
    $('viewer-title').textContent = t('session.connectedTo', { id: formatId(viewerPartnerId) });
    $('viewer').hidden = false;
    applyTheme();
    window.api.setSessionState('viewer');
    viewerSession = session;
    sendBackground();
    const partnerId = viewerPartnerId;
    detachToolbar = attachToolbar(session, {
      partnerId,
      localIsMac: isMac,
      onDisconnect: () => {
        userEnded = true;
        viewer.disconnect();
      },
      onPower: (action) => {
        if (action === 'restart') restartExpectedUntil = Date.now() + RESTART_RECONNECT_MS;
        else if (action !== 'lock') userEnded = true; // asleep or off: nothing to reconnect to
      },
      isFavorite: () => loadMyDevices().some((d) => d.id === partnerId),
      removeFavorite: () => {
        removeMyDevice(partnerId);
        renderMyDevices();
        renderRecent();
      },
      requestFavorite: favoriteAfterConnect === partnerId,
      audio: settings.remoteAudio,
      onAudioChange: (enabled) => {
        settings = { ...settings, remoteAudio: enabled };
        saveSettings(settings);
      },
    });
    favoriteAfterConnect = '';
  },
  onStream: (stream) => {
    video.srcObject = stream;
  },
  onEnd: (error) => {
    detachToolbar?.();
    detachToolbar = undefined;
    viewerSession = undefined;
    video.srcObject = null;
    // A dropped connection (not one either side ended) is retried for a while.
    const retry =
      !userEnded &&
      lastTarget &&
      (error === 'partnerLeft' || (reconnecting && (error === 'notFound' || error === 'noResponse' || error === 'busy')));
    if (retry) {
      const first = !reconnecting;
      if (first) {
        reconnecting = true;
        reconnectUntil = Date.now() + (Date.now() < restartExpectedUntil ? RESTART_RECONNECT_MS : RECONNECT_MS);
        logInfo('viewer', 'connection lost, reconnecting');
      }
      if (Date.now() < reconnectUntil) {
        $('reconnect').hidden = false;
        $('reconnect-text').textContent = t(Date.now() < restartExpectedUntil ? 'reconnect.restart' : 'reconnect.trying');
        reconnectTimer = window.setTimeout(reconnectNow, first ? RECONNECT_FIRST_MS : RECONNECT_GAP_MS);
        return;
      }
    }
    finishViewer(error);
  },
  onPaired: async (id, secret, hostName) => {
    const encrypted = await sealSecret(secret).catch((err) => {
      logError('viewer', `saving the favorite key failed: ${err}`);
      return null;
    });
    if (!encrypted) return false;
    const existing = loadMyDevices().find((d) => d.id === id);
    saveMyDevice({
      id,
      name: hostName || existing?.name || '',
      secret: encrypted,
      added: existing?.added ?? Date.now(),
      lastConnected: Date.now(),
    });
    renderMyDevices();
    renderRecent();
    logInfo('viewer', `favorite saved (${id})`);
    return true;
  },
});

// Reconnecting after the connection dropped: same computer, same password or favorite key.
const RECONNECT_MS = 60_000;
const RESTART_RECONNECT_MS = 180_000; // after we restarted the remote computer
const RECONNECT_GAP_MS = 3000;
const RECONNECT_FIRST_MS = 4000; // give both sides a moment to forget the dead connection
const RECONNECT_FIND_MS = 12_000;
let lastTarget: { id: string; secret: string; trusted: boolean } | undefined;
let reconnecting = false;
let reconnectUntil = 0;
let reconnectTimer = 0;
let restartExpectedUntil = 0;
let userEnded = false;

function reconnectNow() {
  if (!lastTarget || userEnded) return;
  viewerPartnerId = lastTarget.id;
  viewerTrusted = lastTarget.trusted;
  viewer.connect(settings, lastTarget.id, lastTarget.secret, { name: settings.displayName, id: hostId, identity }, lastTarget.trusted, RECONNECT_FIND_MS);
}

$('reconnect-cancel').addEventListener('click', () => {
  userEnded = true;
  clearTimeout(reconnectTimer);
  viewer.disconnect();
  finishViewer();
});

// Ends the viewer session in the UI and shows why, if it failed.
function finishViewer(error?: ViewerError) {
  reconnecting = false;
  clearTimeout(reconnectTimer);
  $('reconnect').hidden = true;
  sendBackground();
  $('viewer').hidden = true;
  applyTheme();
  window.api.setSessionState('idle');
  setViewerBusy(false);
  // In the trusted room a wrong key means this computer no longer trusts us; nobody there
  // means it is offline or has no trusted devices any more.
  const shown = viewerTrusted && error === 'wrongPassword' ? 'untrusted' : error;
  const message = viewerTrusted && shown === 'notFound' ? 'msg.trustedNotFound' : shown && VIEWER_ERRORS[shown];
  const failed = Boolean(shown && shown !== 'partnerLeft' && shown !== 'closed');
  // The trusted way failed: offer the password field right away.
  if (viewerTrusted && failed) {
    $<HTMLInputElement>('partner-id').value = formatId(viewerPartnerId);
    usePassword = true;
    syncTrustedNote();
  }
  setStatus(message ? t(message) : '', failed, failed);
  viewerTrusted = false;
}

function setStatus(text: string, isError = false, details = false) {
  const el = $('connect-status');
  el.textContent = text;
  el.classList.toggle('error', isError);
  // Connection errors link to the log, where the exact reason is written.
  if (isError && details) {
    const details = document.createElement('button');
    details.type = 'button';
    details.className = 'status-details';
    details.textContent = t('log.details');
    details.addEventListener('click', () => void openLog());
    el.append(details);
  }
}

// Diagnostics log

const LEVEL_CLASS: Record<string, string> = { WARN: 'log-warn', ERROR: 'log-error' };

// The newest lines only: thousands of rows make the page slow; Copy still copies everything.
const LOG_VIEW_LINES = 400;

async function renderLog() {
  const view = $('log-view');
  const text = await window.api.readLog();
  view.replaceChildren(
    ...(text
      ? text.split('\n').slice(-LOG_VIEW_LINES).map((line) => {
          const row = document.createElement('div');
          row.textContent = line;
          const level = /^\S+ \S+ (WARN|ERROR)\b/.exec(line)?.[1];
          if (level) row.className = LEVEL_CLASS[level];
          return row;
        })
      : [Object.assign(document.createElement('div'), { className: 'log-empty', textContent: t('log.empty') })]),
  );
  view.scrollTop = view.scrollHeight;
}

async function openLog() {
  showPage('settings');
  await renderLog();
  $('diagnostics').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('log-refresh').addEventListener('click', () => void renderLog());
$('log-reveal').addEventListener('click', () => window.api.revealLog());
$('log-clear').addEventListener('click', () => {
  window.api.clearLog();
  void renderLog();
});
$('log-copy').addEventListener('click', async () => {
  // Version and system first, so a pasted log is useful on its own.
  const header = `Remote Desk ${config.version} · ${config.platform} · ${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? ''}`;
  window.api.copyText(`${header}\n${await window.api.readLog()}`);
  $('log-copy').textContent = t('action.copied');
  setTimeout(() => ($('log-copy').textContent = t('log.copy')), 1500);
});

function setViewerBusy(busy: boolean) {
  viewerBusy = busy;
  $<HTMLButtonElement>('connect-button').disabled = busy;
  $('connect-button').classList.toggle('connecting', busy);
  $('cancel-button').hidden = !busy;
}

$('connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (viewerBusy) return;
  const id = $<HTMLInputElement>('partner-id').value.replace(/\D/g, '');
  const pw = $<HTMLInputElement>('partner-password').value.trim();
  if (!/^\d{9}$/.test(id)) return setStatus(t('msg.invalidId'), true);
  if (id === hostId) return setStatus(t('msg.ownId'), true);
  const known = knownDevice();
  if (known) return void connectTrusted(known);
  viewerPartnerId = id;
  setViewerBusy(true);
  lastTarget = { id, secret: pw, trusted: false };
  userEnded = false;
  viewer.connect(settings, id, pw, { name: settings.displayName, id: hostId, identity });
});
$('cancel-button').addEventListener('click', () => {
  userEnded = true;
  viewer.disconnect();
});

// Partner ID typed as "123 456 789"; pasted text with spaces or dashes is cleaned up too.
const idInput = $<HTMLInputElement>('partner-id');
idInput.maxLength = 11;
idInput.addEventListener('input', () => {
  const caret = idInput.selectionStart ?? idInput.value.length;
  const digitsBefore = idInput.value.slice(0, caret).replace(/\D/g, '').length;
  const formatted = formatId(idInput.value.replace(/\D/g, '').slice(0, 9));
  idInput.value = formatted;
  // Keep the caret after the same digit it followed before formatting.
  let pos = 0;
  for (let seen = 0; pos < formatted.length && seen < digitsBefore; pos++) if (/\d/.test(formatted[pos])) seen++;
  idInput.setSelectionRange(pos, pos);
  usePassword = false;
  syncTrustedNote();
});

// A computer that trusts this device needs no password: hide the field and say so.
let usePassword = false;
const knownDevice = () => {
  const id = idInput.value.replace(/\D/g, '');
  return usePassword || id.length !== 9 ? undefined : loadMyDevices().find((d) => d.id === id);
};
function syncTrustedNote() {
  const device = knownDevice();
  $('trusted-note').hidden = !device;
  $('partner-password').closest<HTMLElement>('.password-field')!.hidden = Boolean(device);
  $<HTMLInputElement>('partner-password').required = !device;
  if (device) {
    $('trusted-note-text').textContent = t('viewer.knownDevice', { name: device.name || formatId(device.id) });
  }
}
$('use-password').addEventListener('click', () => {
  usePassword = true;
  syncTrustedNote();
  $('partner-password').focus();
});

$('reveal-password').addEventListener('click', () => {
  const input = $<HTMLInputElement>('partner-password');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  $('reveal-password').classList.toggle('shown', show);
  $('reveal-password').title = t(show ? 'viewer.hidePassword' : 'viewer.showPassword');
  input.focus();
});

// My devices: computers that remembered this one; connect without the password.

async function connectTrusted(device: MyDevice) {
  if (viewerBusy) return;
  const secret = await openSecret(device.secret);
  if (!secret) return setStatus(t('msg.keyUnreadable'), true);
  showPage('home');
  viewerPartnerId = device.id;
  viewerTrusted = true;
  setViewerBusy(true);
  lastTarget = { id: device.id, secret, trusted: true };
  userEnded = false;
  viewer.connect(settings, device.id, secret, { name: settings.displayName, id: hostId, identity }, true);
}

const STAR_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';

// Favorites: one-click buttons in the connect card for computers that trust this device.
let shownFavorites: Set<string> | undefined;

function renderMyDevices() {
  const devices = loadMyDevices();
  const before = shownFavorites;
  shownFavorites = new Set(devices.map((d) => d.id));
  $('favorites').hidden = devices.length === 0;
  $('favorite-chips').replaceChildren(
    ...devices.map((device) => {
      const chip = document.createElement('span');
      chip.className = 'favorite-chip';
      // Only a favorite added just now pops in (not the ones there since start-up).
      if (before && !before.has(device.id)) chip.classList.add('is-new');
      const connect = document.createElement('button');
      connect.type = 'button';
      connect.className = 'favorite-connect';
      connect.title = `${t('favorites.connect', { id: formatId(device.id) })}\n${t('favorites.linkHint')}`;
      connect.innerHTML = STAR_ICON;
      connect.append(device.name || formatId(device.id));
      connect.addEventListener('click', () => void connectTrusted(device));
      // Right-click copies a remotedesk:// link for Shortcuts, Raycast or a desktop shortcut.
      connect.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        window.api.copyText(`remotedesk://connect/${device.id}`);
        setStatus(t('favorites.linkCopied', { name: device.name || formatId(device.id) }));
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'favorite-remove';
      remove.title = t('favorites.remove');
      remove.setAttribute('aria-label', t('favorites.remove'));
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        removeMyDevice(device.id);
        renderMyDevices();
        renderRecent();
      });
      chip.append(connect, remove);
      return chip;
    }),
  );
  syncTrustedNote();
  sendBackground();
}
$('sidebar-connect').addEventListener('click', () => {
  showPage('home');
  $('partner-id').focus();
});

// Recent partners

function renderRecent() {
  const list = loadRecent();
  const container = $('recent-list');
  container.replaceChildren();
  $('recent-empty').hidden = list.length > 0;
  const dateFormat = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' });

  for (const partner of list) {
    const row = document.createElement('div');
    row.className = 'recent-row';

    const id = document.createElement('span');
    id.className = 'recent-id';
    id.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
    id.append(formatId(partner.id));

    const date = document.createElement('span');
    date.className = 'recent-date';
    date.textContent = dateFormat.format(partner.lastConnected);

    const actions = document.createElement('span');
    actions.className = 'row-actions';
    // Star: favorites connect without a password. Adding one needs a connection (with the
    // password this time) and approval on the other computer.
    const isFavorite = loadMyDevices().some((d) => d.id === partner.id);
    const star = document.createElement('button');
    star.className = 'star-button';
    star.classList.toggle('on', isFavorite);
    star.innerHTML = STAR_ICON;
    star.title = t(isFavorite ? 'favorites.remove' : 'favorites.add');
    star.addEventListener('click', () => {
      if (isFavorite) {
        removeMyDevice(partner.id);
        renderMyDevices();
        renderRecent();
        return;
      }
      favoriteAfterConnect = partner.id;
      $<HTMLInputElement>('partner-id').value = formatId(partner.id);
      $<HTMLInputElement>('partner-password').value = '';
      usePassword = true;
      syncTrustedNote();
      $('partner-password').focus();
      setStatus(t('favorites.enterPassword'));
    });
    const connect = document.createElement('button');
    connect.className = 'small-button';
    connect.textContent = t('recent.connect');
    connect.addEventListener('click', () => {
      const trusted = loadMyDevices().find((d) => d.id === partner.id);
      if (trusted) return void connectTrusted(trusted);
      $<HTMLInputElement>('partner-id').value = formatId(partner.id);
      $<HTMLInputElement>('partner-password').value = '';
      $('partner-password').focus();
    });
    const remove = document.createElement('button');
    remove.className = 'small-button remove';
    remove.textContent = t('recent.remove');
    remove.addEventListener('click', () => {
      removeRecent(partner.id);
      renderRecent();
    });
    actions.append(connect, remove);

    row.append(id, date, star, actions);
    container.append(row);
  }
}

// Settings

const networkRadios = () => document.querySelectorAll<HTMLInputElement>('input[name="network"]');

function updateServerFields() {
  const own = [...networkRadios()].find((r) => r.checked)?.value === 'own';
  $('own-server-fields').hidden = !own;
}

// Removes every trusted device and replaces the room key, so copies of it stop working.
// Needs a second click so it can't happen by accident.
$('trusted-reset').addEventListener('click', () => {
  const button = $('trusted-reset');
  if (!button.dataset.armed) {
    button.dataset.armed = '1';
    button.textContent = t('trusted.resetConfirm');
    setTimeout(() => renderTrusted(), 4000);
    return;
  }
  resetTrust();
  logInfo('host', 'all trusted devices removed, room key replaced');
  void host.restartTrustedRoom();
  renderTrusted();
});

// Menu bar/tray icon and Dock menu: favorites, this computer's ID and password, the session.
let hostSession: HostSession | null = null;

function sendBackground() {
  const viewing = viewerSession ? loadMyDevices().find((d) => d.id === viewerPartnerId)?.name || formatId(viewerPartnerId) : '';
  const status = hostSession
    ? t('tray.beingControlled', { who: describeVisitor(hostSession) })
    : viewing
      ? t('tray.connectedTo', { name: viewing })
      : undefined;
  window.api.setTrayState({
    background: settings.runInBackground,
    showIcon: settings.showTray,
    tooltip: t('tray.tooltip', { id: formatId(hostId) }),
    open: t('tray.open'),
    quit: t('tray.quit'),
    favoritesTitle: t('favorites.title'),
    copyId: t('tray.copyId', { id: formatId(hostId) }),
    copyPassword: t('tray.copyPassword'),
    status,
    disconnect: status ? t('session.disconnect') : undefined,
    favorites: loadMyDevices().map((d) => ({ id: d.id, label: d.name || formatId(d.id) })),
  });
}

// remotedesk://connect/<id>: favorites connect at once, other computers get the ID filled in.
function openLink(link: { action: 'connect'; id: string }) {
  showPage('home');
  const device = loadMyDevices().find((d) => d.id === link.id);
  if (device) {
    if (!viewerSession && !viewerBusy) void connectTrusted(device);
    return;
  }
  $<HTMLInputElement>('partner-id').value = formatId(link.id);
  usePassword = false;
  syncTrustedNote();
  $('partner-password').focus();
}

window.api.onTrayAction((action) => {
  if (action.type === 'copy-id') window.api.copyText(hostId);
  if (action.type === 'copy-password') window.api.copyText(password);
  if (action.type === 'disconnect') {
    if (hostSession) host.disconnect();
    else viewer.disconnect();
  }
  if (action.type === 'connect') {
    const device = loadMyDevices().find((d) => d.id === action.id);
    if (device && !viewerSession) void connectTrusted(device);
  }
});

function renderHistory() {
  const records = loadHistory();
  const dateFormat = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' });
  $('history-empty').hidden = records.length > 0;
  $('history-clear').hidden = records.length === 0;
  $('history-list').replaceChildren(
    ...records.slice(0, 30).map((r) => {
      const row = document.createElement('div');
      row.className = 'trusted-row';
      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = describeVisitor({ name: r.name, id: r.id });
      const meta = document.createElement('small');
      const length = r.seconds === undefined ? t('history.ongoing') : formatDuration(r.seconds);
      meta.textContent = [
        dateFormat.format(r.at),
        length,
        t(r.control ? 'history.control' : 'history.view'),
        r.trusted ? t('history.favorite') : t('history.password'),
      ].join(' · ');
      text.append(name, meta);
      row.append(text);
      return row;
    }),
  );
}

const formatDuration = (seconds: number) =>
  seconds < 60 ? t('history.seconds', { n: String(seconds) }) : t('history.minutes', { n: String(Math.round(seconds / 60)) });

$('history-clear').addEventListener('click', () => {
  clearHistory();
  renderHistory();
});

function renderTrusted() {
  const devices = loadTrusted();
  const dateFormat = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium' });
  $('trusted-empty').hidden = devices.length > 0;
  $('trusted-reset').hidden = devices.length === 0;
  $('trusted-reset').textContent = t('trusted.reset');
  delete $('trusted-reset').dataset.armed;
  $('trusted-list').replaceChildren(
    ...devices.map((device) => {
      const row = document.createElement('div');
      row.className = 'trusted-row';
      const text = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = device.name || t('trusted.unnamed');
      const meta = document.createElement('small');
      meta.textContent = t('trusted.meta', {
        id: device.id ? formatId(device.id) : '—',
        mode: t(device.control ? 'panel.modeControl' : 'panel.modeView'),
        date: dateFormat.format(device.added),
      });
      text.append(name, meta);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'small-button remove';
      remove.textContent = t('recent.remove');
      remove.addEventListener('click', () => {
        removeTrusted(device.fingerprint);
        logInfo('host', 'trusted device removed');
        host.syncTrustedRoom();
        renderTrusted();
      });
      row.append(text, remove);
      return row;
    }),
  );
}

function fillSettingsForm() {
  renderTrusted();
  $<HTMLInputElement>('setting-name').value = settings.displayName;
  $<HTMLInputElement>('setting-background').checked = settings.runInBackground;
  $<HTMLInputElement>('setting-keep-awake').checked = settings.keepAwake;
  $<HTMLInputElement>('setting-show-tray').checked = settings.showTray;
  $<HTMLInputElement>('setting-allow-privacy').checked = settings.allowPrivacy;
  $<HTMLSelectElement>('setting-language').value = settings.language;
  refreshSelects();
  for (const radio of networkRadios()) radio.checked = radio.value === (settings.serverUrl ? 'own' : 'public');
  $<HTMLInputElement>('setting-server').value = settings.serverUrl;
  $<HTMLInputElement>('setting-turn-url').value = settings.turnUrl;
  $<HTMLInputElement>('setting-turn-user').value = settings.turnUsername;
  $<HTMLInputElement>('setting-turn-credential').value = settings.turnCredential;
  $('settings-status').textContent = '';
  updateServerFields();
}

for (const radio of networkRadios()) radio.addEventListener('change', updateServerFields);

$('settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const own = [...networkRadios()].find((r) => r.checked)?.value === 'own';
  const serverUrl = own ? $<HTMLInputElement>('setting-server').value.trim() : '';
  const status = $('settings-status');
  if (own && !/^wss?:\/\/\S+$/.test(serverUrl)) {
    status.textContent = t('settings.invalidUrl');
    status.classList.add('error');
    return;
  }
  const next: Settings = {
    ...settings,
    displayName: $<HTMLInputElement>('setting-name').value.trim(),
    runInBackground: $<HTMLInputElement>('setting-background').checked,
    keepAwake: $<HTMLInputElement>('setting-keep-awake').checked,
    showTray: $<HTMLInputElement>('setting-show-tray').checked,
    allowPrivacy: $<HTMLInputElement>('setting-allow-privacy').checked,
    language: $<HTMLSelectElement>('setting-language').value as Settings['language'],
    serverUrl,
    turnUrl: $<HTMLInputElement>('setting-turn-url').value.trim(),
    turnUsername: $<HTMLInputElement>('setting-turn-user').value.trim(),
    turnCredential: $<HTMLInputElement>('setting-turn-credential').value,
  };
  const networkChanged =
    next.serverUrl !== settings.serverUrl ||
    next.turnUrl !== settings.turnUrl ||
    next.turnUsername !== settings.turnUsername ||
    next.turnCredential !== settings.turnCredential;
  settings = next;
  saveSettings(settings);
  logInfo('settings', `saved (${settings.serverUrl ? 'own server' : 'public network'}${settings.turnUrl ? ', TURN set' : ''}, language ${settings.language}, background ${settings.runInBackground ? 'on' : 'off'}, keep awake ${settings.keepAwake ? 'on' : 'off'})`);
  window.api.setKeepAwake(settings.keepAwake);
  host.setPrivacyAllowed(settings.allowPrivacy);
  applyLanguage();
  renderNetwork();
  if (networkChanged && !host.active) restartHost();
  status.classList.remove('error');
  status.textContent = t('settings.saved');
});

function applyLanguage() {
  setLanguage(settings.language, config.locale);
  renderRecent();
  renderNetwork();
  renderHelp($('help-content'));
  renderChangelog();
  renderUpdate();
  refreshStatus();
  refreshSelects();
  renderMyDevices();
  sendBackground();
}

// Updates, what's new and feedback

let updateState: UpdateState = await window.api.getUpdateState();
const releases: Release[] = parseChangelog(await window.api.getChangelog());
const updateOffered = () =>
  updateState.status === 'ready' || (updateState.status === 'available' && !updateState.canInstall);

function updateActionLabel() {
  return t(updateState.status === 'ready' ? 'update.install' : 'update.download');
}

function runUpdateAction() {
  if (updateState.status === 'ready') window.api.installUpdate();
  else window.api.openDownloadPage();
}

function renderUpdate() {
  const { status, version = '' } = updateState;
  const vars = { version, current: config.version };
  $('news-version').textContent = config.version;
  renderTrack();
  $('update-status').textContent = t(`update.${status}` as MessageKey, vars);
  $('update-check').hidden = status === 'unsupported';
  const offered = updateOffered();
  $('update-banner').hidden = !offered;
  $('news-badge').hidden = !offered;
  $('update-primary').hidden = !offered;
  // Orange as soon as there is something to get; otherwise a quiet, disabled button.
  const get = $<HTMLButtonElement>('update-get');
  const pending = offered || status === 'downloading' || (status === 'available' && updateState.canInstall);
  get.hidden = status === 'unsupported';
  get.classList.toggle('accent-button', pending);
  get.disabled = !offered;
  $('update-get-label').textContent = t(
    status === 'ready' ? 'update.install' : status === 'downloading' ? 'update.downloadingShort' : 'update.get',
  );
  if (offered) {
    $('update-banner-text').textContent = t(status === 'ready' ? 'update.bannerReady' : 'update.bannerAvailable', vars);
    $('update-banner-action').textContent = t('update.whatsNew');
    $('update-primary-label').textContent = t('update.whatsNew');
  }
}

function renderChangelog() {
  $('changelog').replaceChildren(...releases.map((r) => renderRelease(r, currentLanguage())));
}

async function openWhatsNew(mode: 'update' | 'installed') {
  const version = mode === 'update' ? updateState.version ?? '' : config.version;
  let release = releases.find((r) => r.version === version);
  if (mode === 'update') {
    const remote = await window.api.getRemoteChangelog(version);
    release = remote ? parseChangelog(remote).find((r) => r.version === version) : undefined;
  }
  $('whats-new-title').textContent = t(mode === 'update' ? 'news.titleUpdate' : 'news.titleInstalled', { version });
  const body = $('whats-new-body');
  if (release) {
    body.replaceChildren(renderRelease(release, currentLanguage(), false));
  } else {
    const note = document.createElement('p');
    note.className = 'hint';
    note.textContent = t('news.notesUnavailable');
    body.replaceChildren(note);
  }
  const action = $<HTMLButtonElement>('whats-new-action');
  action.dataset.mode = mode;
  action.hidden = mode === 'update' && !updateOffered();
  $('whats-new-action-label').textContent = mode === 'update' ? updateActionLabel() : t('news.close');
  // "Close" doesn't lead anywhere, so it gets no arrow.
  $('whats-new-action-arrow').hidden = mode !== 'update';
  action.classList.toggle('no-arrow', mode !== 'update');
  $('whats-new').hidden = false;
  action.focus();
}

const closeWhatsNew = () => ($('whats-new').hidden = true);

window.api.onUpdateState((state) => {
  updateState = state;
  renderUpdate();
});
$('update-check').addEventListener('click', () => window.api.checkForUpdates());

// Which version to follow: newest stable, newest including betas, or one chosen version.
const trackSelect = $<HTMLSelectElement>('update-track');
enhanceSelect(trackSelect);

function renderTrack() {
  const trackSelect = $<HTMLSelectElement>('update-track');
  $('update-track-row').hidden = updateState.status === 'unsupported';
  const option = (value: string, text: string) => Object.assign(document.createElement('option'), { value, textContent: text });
  // A chosen version that the list doesn't show (e.g. offline) still appears.
  const pinned =
    !['stable', 'beta'].includes(updateTrack) && !releaseList.some((r) => r.version === updateTrack)
      ? [{ version: updateTrack, prerelease: updateTrack.includes('-') }]
      : [];
  trackSelect.replaceChildren(
    option('stable', t('update.trackStable')),
    option('beta', t('update.trackBeta')),
    ...[...pinned, ...releaseList].map((r) =>
      option(
        r.version,
        [r.version, r.prerelease && t('update.trackBetaTag'), r.version === config.version && t('update.trackInstalled')].filter(Boolean).join(' · '),
      ),
    ),
  );
  trackSelect.value = updateTrack;
  refreshSelects();
  $('update-track-hint').textContent = t(
    updateTrack === 'stable' ? 'update.trackHintStable' : updateTrack === 'beta' ? 'update.trackHintBeta' : 'update.trackHintPinned',
  );
}

async function loadReleases() {
  releaseList = await window.api.listReleases();
  renderTrack();
}

void window.api.getUpdateTrack().then((value) => {
  updateTrack = value;
  renderTrack();
});
trackSelect.addEventListener('change', () => {
  updateTrack = trackSelect.value;
  window.api.setUpdateTrack(updateTrack);
  logInfo('settings', `update track: ${updateTrack}`);
  renderTrack();
});
$('update-get').addEventListener('click', runUpdateAction);
$('update-banner-action').addEventListener('click', () => void openWhatsNew('update'));
$('update-primary').addEventListener('click', () => void openWhatsNew('update'));
$('whats-new-close').addEventListener('click', closeWhatsNew);
$('whats-new').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeWhatsNew();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('whats-new').hidden) closeWhatsNew();
});
$('whats-new-action').addEventListener('click', () => {
  if ($('whats-new-action').dataset.mode === 'update') runUpdateAction();
  closeWhatsNew();
});
$('feedback-bug').addEventListener('click', () => window.api.openFeedback('bug'));
$('feedback-idea').addEventListener('click', () => window.api.openFeedback('idea'));

// Show the notes once after the app was updated (not on the very first start).
function showNotesAfterUpdate() {
  const seen = settings.lastSeenVersion;
  if (seen === config.version) return;
  settings = { ...settings, lastSeenVersion: config.version };
  saveSettings(settings);
  if (seen) void openWhatsNew('installed');
}

// macOS permissions

async function refreshPermissions() {
  if (!isMac) return;
  const perms = await window.api.getPermissions();
  const screenOk = perms.screen === 'granted';
  const setBadge = (id: string, ok: boolean) => {
    const badge = $(id);
    badge.textContent = t(ok ? 'perm.granted' : 'perm.missing');
    badge.classList.toggle('ok', ok);
  };
  setBadge('perm-screen-status', screenOk);
  setBadge('perm-accessibility-status', perms.accessibility);
  $('permission-banner').hidden = screenOk && perms.accessibility;
  // "Fix" is offered only for a missing permission, never to reset a working one.
  $('perm-fix-hint').hidden = screenOk && perms.accessibility;
  for (const button of document.querySelectorAll<HTMLElement>('[data-reset]')) {
    button.hidden = button.dataset.reset === 'screen' ? screenOk : perms.accessibility;
  }
}

for (const button of document.querySelectorAll<HTMLElement>('[data-reset]')) {
  button.addEventListener('click', async () => {
    const ok = await window.api.resetPermission(button.dataset.reset as PermissionKind);
    const hint = $('perm-fix-hint');
    hint.textContent = t(ok ? 'perm.fixHint' : 'perm.fixFailed');
    hint.classList.toggle('error-text', !ok);
  });
}

// Shared clipboard: whichever role is active forwards local copies to the partner.
window.api.onClipboardFiles((offers) => host.offerFiles(offers));
window.api.onClipboardChange((text) => {
  host.shareClipboard(text);
  viewerSession?.shareClipboard(text);
});

for (const button of document.querySelectorAll<HTMLElement>('[data-permission]')) {
  button.addEventListener('click', () => window.api.requestPermission(button.dataset.permission as PermissionKind));
}
$('relaunch').addEventListener('click', () => window.api.relaunch());
window.addEventListener('focus', () => void refreshPermissions());

// Start

document.body.classList.add(`platform-${config.platform}`);
for (const el of document.querySelectorAll<HTMLElement>('.mac-only')) el.hidden = !isMac;
$('version').textContent = `v${config.version}`;
document.querySelectorAll('select').forEach(enhanceSelect);
window.api.setKeepAwake(settings.keepAwake);
applyTheme();
applyLanguage();
// Start-up: the sidebar and the home page assemble themselves.
animateIn([...document.querySelectorAll('.sidebar > *'), ...pageParts($('page-home'))]);
void window.api.onDeepLink(openLink).then((link) => link && openLink(link));
void refreshPermissions();
showNotesAfterUpdate();
restartHost();
setInterval(refreshStatus, STATUS_POLL_MS);
