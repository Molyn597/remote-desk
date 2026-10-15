import type { Api, SessionPanelInfo } from '../preload/api';

declare global {
  interface Window {
    api: Api;
  }
}

const $ = (id: string) => document.getElementById(id)!;
let info: SessionPanelInfo | undefined;

function render() {
  if (!info) return;
  $('title').textContent = info.title;
  $('mode').textContent = info.mode;
  $('pause').hidden = !info.canControl;
  $('pause').textContent = info.paused ? info.resumeLabel : info.pauseLabel;
  $('disconnect').textContent = info.disconnectLabel;
}

function tick() {
  if (!info) return;
  const seconds = Math.max(0, Math.floor((Date.now() - info.startedAt) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  $('timer').textContent = `${mm}:${ss}`;
}

window.api.onSessionPanelInfo((next) => {
  info = next;
  render();
  tick();
});
$('pause').addEventListener('click', () => window.api.sendSessionAction(info?.paused ? 'resume' : 'pause'));
$('disconnect').addEventListener('click', () => window.api.sendSessionAction('disconnect'));
setInterval(tick, 1000);
