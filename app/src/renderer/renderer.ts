import type { Api, PermissionKind, UpdateState } from '../preload/api';
import { parseChangelog, renderRelease, type Release } from './changelog';
import { renderHelp } from './help';
import { enhanceSelect, refreshSelects } from './select';
import { Host, type HostSession, type Visitor } from './host';
import { loadIdentity } from './identity';
import { currentLanguage, setLanguage, t, type MessageKey } from './i18n';
import { isOnline } from './network';
import {
  addRecent,
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

// Navigation

function showPage(page: Page) {
  for (const p of ['home', 'settings', 'permissions', 'news', 'help'] as const) $(`page-${p}`).hidden = p !== page;
  for (const item of document.querySelectorAll<HTMLElement>('.nav-item')) {
    item.classList.toggle('active', item.dataset.nav === page);
  }
  if (page === 'settings') fillSettingsForm();
  if (page === 'permissions') void refreshPermissions();
  if (page === 'help') renderHelp($('help-content'));
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
  applyTheme();
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
  pickerTitle: () => t('files.pickTitle'),
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
    $('host-banner').hidden = !session;
    showSessionPanel(session);
    if (error === 'capture') {
      showPage('home');
      setStatus(t('msg.hostCapture'), true);
    }
  },
});

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
  $('my-password').textContent = password;
  restartHost();
});
$('host-disconnect').addEventListener('click', () => host.disconnect());

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
  button.addEventListener('click', () => {
    window.api.copyText($(button.dataset.copy!).textContent!.replace(/\s/g, ''));
    button.classList.add('copied');
    button.title = t('action.copied');
    setTimeout(() => {
      button.classList.remove('copied');
      button.title = t('action.copy');
    }, 1500);
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
  untrusted: 'msg.untrusted',
};

let viewerTrusted = false;

let viewerPartnerId = '';

const viewer = new Viewer(config.platform, {
  onStatus: (status) => setStatus(t(status === 'searching' ? 'msg.searching' : 'msg.waiting')),
  onConnected: (session) => {
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
    detachToolbar = attachToolbar(session, {
      partnerId: viewerPartnerId,
      localIsMac: isMac,
      onDisconnect: () => viewer.disconnect(),
    });
  },
  onStream: (stream) => {
    video.srcObject = stream;
  },
  onEnd: (error) => {
    detachToolbar?.();
    detachToolbar = undefined;
    viewerSession = undefined;
    video.srcObject = null;
    $('viewer').hidden = true;
    applyTheme();
    window.api.setSessionState('idle');
    setViewerBusy(false);
    // In the trusted room a wrong key means this computer no longer trusts us; nobody there
    // means it is offline or has no trusted devices any more.
    const shown = viewerTrusted && error === 'wrongPassword' ? 'untrusted' : error;
    const message = viewerTrusted && shown === 'notFound' ? 'msg.trustedNotFound' : shown && VIEWER_ERRORS[shown];
    setStatus(message ? t(message) : '', Boolean(shown && shown !== 'partnerLeft'));
    viewerTrusted = false;
  },
  onPaired: async (id, secret, hostName) => {
    const encrypted = await window.api.protect(secret);
    if (!encrypted) return; // no OS encryption: don't keep the key in plain text
    const existing = loadMyDevices().find((d) => d.id === id);
    saveMyDevice({
      id,
      name: hostName || existing?.name || '',
      secret: encrypted,
      added: existing?.added ?? Date.now(),
      lastConnected: Date.now(),
    });
    renderMyDevices();
  },
});

function setStatus(text: string, isError = false) {
  const el = $('connect-status');
  el.textContent = text;
  el.classList.toggle('error', isError);
}

function setViewerBusy(busy: boolean) {
  viewerBusy = busy;
  $<HTMLButtonElement>('connect-button').disabled = busy;
  $('cancel-button').hidden = !busy;
}

$('connect-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (viewerBusy) return;
  const id = $<HTMLInputElement>('partner-id').value.replace(/\D/g, '');
  const pw = $<HTMLInputElement>('partner-password').value.trim();
  if (!/^\d{9}$/.test(id)) return setStatus(t('msg.invalidId'), true);
  if (id === hostId) return setStatus(t('msg.ownId'), true);
  viewerPartnerId = id;
  setViewerBusy(true);
  viewer.connect(settings, id, pw, { name: settings.displayName, id: hostId, identity });
});
$('cancel-button').addEventListener('click', () => viewer.disconnect());

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
  const secret = await window.api.unprotect(device.secret);
  if (!secret) return setStatus(t('msg.keyUnreadable'), true);
  showPage('home');
  viewerPartnerId = device.id;
  viewerTrusted = true;
  setViewerBusy(true);
  viewer.connect(settings, device.id, secret, { name: settings.displayName, id: hostId, identity }, true);
}

function renderMyDevices() {
  const devices = loadMyDevices();
  $('devices-panel').hidden = devices.length === 0;
  const dateFormat = new Intl.DateTimeFormat(currentLanguage(), { dateStyle: 'medium', timeStyle: 'short' });
  $('devices-list').replaceChildren(
    ...devices.map((device) => {
      const row = document.createElement('div');
      row.className = 'recent-row';

      const label = document.createElement('span');
      label.className = 'recent-id';
      label.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
      const text = document.createElement('span');
      text.className = 'device-name';
      const name = document.createElement('strong');
      name.textContent = device.name || formatId(device.id);
      text.append(name);
      if (device.name) {
        const id = document.createElement('small');
        id.textContent = formatId(device.id);
        text.append(id);
      }
      label.append(text);

      const date = document.createElement('span');
      date.className = 'recent-date';
      date.textContent = device.lastConnected ? dateFormat.format(device.lastConnected) : '';

      const actions = document.createElement('span');
      actions.className = 'row-actions';
      const connect = document.createElement('button');
      connect.className = 'small-button';
      connect.textContent = t('recent.connect');
      connect.addEventListener('click', () => void connectTrusted(device));
      const remove = document.createElement('button');
      remove.className = 'small-button remove';
      remove.textContent = t('recent.remove');
      remove.addEventListener('click', () => {
        removeMyDevice(device.id);
        renderMyDevices();
      });
      actions.append(connect, remove);
      row.append(label, date, actions);
      return row;
    }),
  );
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

    row.append(id, date, actions);
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
  void host.restartTrustedRoom();
  renderTrusted();
});

function sendBackground() {
  window.api.setBackground(settings.runInBackground, {
    open: t('tray.open'),
    quit: t('tray.quit'),
    tooltip: t('tray.tooltip', { id: formatId(hostId) }),
  });
}

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
applyTheme();
applyLanguage();
void refreshPermissions();
showNotesAfterUpdate();
restartHost();
setInterval(refreshStatus, STATUS_POLL_MS);
