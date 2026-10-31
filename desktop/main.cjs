const { app, BrowserWindow, Menu, shell } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = process.argv.includes('--dev') || process.env.SJ_DEV === '1'
const shotArg = process.argv.find((a) => a.startsWith('--shot='))
const shotPath = shotArg ? shotArg.slice('--shot='.length) : null
const DEV_URL = 'http://127.0.0.1:4317/?mode=desktop'
const distIndex = path.join(__dirname, '..', 'dist', 'index.html')

const stateFile = path.join(app.getPath('userData'), 'window-state.json')

function loadBounds() {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    if (raw && Number.isFinite(raw.width) && Number.isFinite(raw.height)) {
      return { width: raw.width, height: raw.height, x: raw.x, y: raw.y }
    }
  } catch {
    /* 首次启动，无状态文件 */
  }
  return { width: 1440, height: 900 }
}

function saveBounds(target) {
  if (!target || target.isDestroyed()) return
  try {
    const { width, height, x, y } = target.getBounds()
    fs.mkdirSync(path.dirname(stateFile), { recursive: true })
    fs.writeFileSync(stateFile, JSON.stringify({ width, height, x, y }))
  } catch {
    /* 状态保存失败不影响退出 */
  }
}

/** @type {BrowserWindow | null} */
let win = null

function createWindow() {
  win = new BrowserWindow({
    ...loadBounds(),
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#0C1422',
    title: '思祁.Work',
    icon: path.join(__dirname, 'icon.ico'),
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  win.once('ready-to-show', () => win?.show())
  win.on('close', () => saveBounds(win))
  win.on('closed', () => {
    win = null
  })

  // 外部链接交给系统浏览器，应用内不开新窗口
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    win.loadURL(DEV_URL)
    win.webContents.openDevTools({ mode: 'detach' })
  } else if (fs.existsSync(distIndex)) {
    win.loadFile(distIndex, { query: { mode: 'desktop' } })
  } else {
    win.loadURL(DEV_URL)
  }

  // 文档 / 评审：渲染完成后截图并退出
  if (shotPath) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          const image = await win.capturePage()
          fs.writeFileSync(shotPath, image.toPNG())
          console.log('screenshot saved:', shotPath)
        } catch (err) {
          console.error('screenshot failed:', err)
        }
        app.quit()
      }, 1200)
    })
  }

  // F11 全屏；开发模式下 Ctrl+Shift+I 打开开发者工具
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      win?.setFullScreen(!win.isFullScreen())
      event.preventDefault()
    }
    if (isDev && input.key.toLowerCase() === 'i' && input.control && input.shift) {
      win?.webContents.toggleDevTools()
      event.preventDefault()
    }
  })
}

app.setAppUserModelId('com.sisqi.work')

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
