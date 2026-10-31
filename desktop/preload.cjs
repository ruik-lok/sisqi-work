const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sisqi', {
  desktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  secrets: {
    get: (id) => ipcRenderer.invoke('secrets:get', id),
    set: (id, value) => ipcRenderer.invoke('secrets:set', id, value),
    delete: (id) => ipcRenderer.invoke('secrets:delete', id),
  },
})