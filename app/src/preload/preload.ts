import { contextBridge, ipcRenderer } from 'electron';
import type { Api } from './api';

const api: Api = {
  getConfig: () => ipcRenderer.invoke('config'),
  getPermissions: () => ipcRenderer.invoke('permissions'),
  requestPermission: (kind) => ipcRenderer.invoke('request-permission', kind),
  relaunch: () => ipcRenderer.send('relaunch'),
  copyText: (text) => ipcRenderer.send('copy-text', text),
  confirmConnection: (text) => ipcRenderer.invoke('confirm-connection', text),
  setSessionState: (state) => ipcRenderer.send('session-state', state),
  sendInput: (ev) => ipcRenderer.send('input', ev),
  showSessionPanel: (info) => ipcRenderer.send('session-panel', info),
  onSessionAction: (handler) => ipcRenderer.on('session-action', (_e, action) => handler(action)),
  onSessionPanelInfo: (handler) => ipcRenderer.on('session-panel-info', (_e, info) => handler(info)),
  sendSessionAction: (action) => ipcRenderer.send('session-action', action),
  getUpdateState: () => ipcRenderer.invoke('update-state'),
  onUpdateState: (handler) => ipcRenderer.on('update-state', (_e, state) => handler(state)),
  checkForUpdates: () => ipcRenderer.send('update-check'),
  installUpdate: () => ipcRenderer.send('update-install'),
  openDownloadPage: () => ipcRenderer.send('update-download-page'),
};

contextBridge.exposeInMainWorld('api', api);
