const { contextBridge } = require('electron')

// 只暴露只读的运行环境信息，业务数据仍走 Web 层
contextBridge.exposeInMainWorld('sisqi', {
  desktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
})
