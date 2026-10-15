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
};

contextBridge.exposeInMainWorld('api', api);
