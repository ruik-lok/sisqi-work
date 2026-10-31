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
  workspace: {
    open: () => ipcRenderer.invoke('workspace:open'),
    list: (root) => ipcRenderer.invoke('workspace:list', root),
    read: (root, rel) => ipcRenderer.invoke('workspace:read', root, rel),
    write: (root, rel, content) => ipcRenderer.invoke('workspace:write', root, rel, content),
    exec: (root, command) => ipcRenderer.invoke('workspace:exec', root, command),
  },
})