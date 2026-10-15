import type { Api, PermissionKind } from '../preload/api';
import { Host } from './host';
import { currentLanguage, setLanguage, t, type MessageKey } from './i18n';
import { isOnline } from './network';
import { addRecent, loadHostId, loadRecent, loadSettings, removeRecent, saveSettings, type Settings } from './settings';
import { Viewer, type ViewerError } from './viewer';
import { attachToolbar } from './viewer-toolbar';

declare global {
  interface Window {
    api: Api;
  }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const PASSWORD_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
const STATUS_POLL_MS = 2000;

type Page = 'home' | 'settings' | 'permissions';

const config = await window.api.getConfig();
const isMac = config.platform === 'darwin';
const video = $<HTMLVideoElement>('remote-video');
const hostId = loadHostId();

let settings = loadSettings();
let password = generatePassword();
let detachToolbar: (() => void) | undefined;
let viewerBusy = false;

function generatePassword(length = 8): string {
  // 32 symbols divide 256 evenly, so the modulo is unbiased.
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]).join('');
}

const formatId = (id: string) => id.replace(/(\d{3})(?=\d)/g, '$1 ');

// Navigation

function showPage(page: Page) {
  for (const p of ['home', 'settings', 'permissions'] as const) $(`page-${p}`).hidden = p !== page;
  for (const item of document.querySelectorAll<HTMLElement>('.nav-item')) {
    item.classList.toggle('active', item.dataset.nav === page);
  }
  if (page === 'settings') fillSettingsForm();
  if (page === 'permissions') void refreshPermissions();
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
}

// Host

const host = new Host(config.platform, {
  confirm: () =>
    window.api.confirmConnection({
      title: t('confirm.title'),
      detail: t('confirm.detail'),
      allow: t('confirm.allow'),
      deny: t('confirm.deny'),
    }),
  onSessionChange: (active, error) => {
    $('host-banner').hidden = !active;
    if (error === 'capture') {
      showPage('home');
      setStatus(t('msg.hostCapture'), true);
    }
  },
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
    button.textContent = t('action.copied');
    setTimeout(() => (button.textContent = t('action.copy')), 1500);
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
};

let viewerPartnerId = '';

const viewer = new Viewer(config.platform, {
  onStatus: (status) => setStatus(t(status === 'searching' ? 'msg.searching' : 'msg.waiting')),
  onConnected: (session) => {
    addRecent(viewerPartnerId);
    renderRecent();
    setStatus('');
    $('viewer-title').textContent = t('session.connectedTo', { id: formatId(viewerPartnerId) });
    $('viewer').hidden = false;
    window.api.setSessionState('viewer');
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
    video.srcObject = null;
    $('viewer').hidden = true;
    window.api.setSessionState('idle');
    setViewerBusy(false);
    setStatus(error ? t(VIEWER_ERRORS[error]) : '', Boolean(error && error !== 'partnerLeft'));
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
  const id = $<HTMLInputElement>('partner-id').value.replace(/\s/g, '');
  const pw = $<HTMLInputElement>('partner-password').value.trim();
  if (!/^\d{9}$/.test(id)) return setStatus(t('msg.invalidId'), true);
  if (id === hostId) return setStatus(t('msg.ownId'), true);
  viewerPartnerId = id;
  setViewerBusy(true);
  viewer.connect(settings, id, pw);
});
$('cancel-button').addEventListener('click', () => viewer.disconnect());
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

function fillSettingsForm() {
  $<HTMLSelectElement>('setting-language').value = settings.language;
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
  refreshStatus();
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
}

for (const button of document.querySelectorAll<HTMLElement>('[data-permission]')) {
  button.addEventListener('click', () => window.api.requestPermission(button.dataset.permission as PermissionKind));
}
$('relaunch').addEventListener('click', () => window.api.relaunch());
window.addEventListener('focus', () => void refreshPermissions());

// Start

document.body.classList.add(`platform-${config.platform}`);
for (const el of document.querySelectorAll<HTMLElement>('.mac-only')) el.hidden = !isMac;
$('version').textContent = `v${config.version}`;
applyLanguage();
void refreshPermissions();
restartHost();
setInterval(refreshStatus, STATUS_POLL_MS);
