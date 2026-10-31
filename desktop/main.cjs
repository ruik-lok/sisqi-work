const { app, BrowserWindow, Menu, shell, ipcMain, safeStorage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const isDev = process.argv.includes('--dev') || process.env.SJ_DEV === '1'
const shotArg = process.argv.find((a) => a.startsWith('--shot='))
const shotPath = shotArg ? shotArg.slice('--shot='.length) : null
const DEV_URL = 'http://127.0.0.1:4317/?mode=desktop'
const distIndex = path.join(__dirname, '..', 'dist', 'index.html')

const stateFile = path.join(app.getPath('userData'), 'window-state.json')
const secretFile = path.join(app.getPath('userData'), 'secrets.json')

function readSecrets() {
  try {
    return JSON.parse(fs.readFileSync(secretFile, 'utf8'))
  } catch {
    return {}
  }
}

function writeSecrets(data) {
  fs.mkdirSync(path.dirname(secretFile), { recursive: true })
  fs.writeFileSync(secretFile, JSON.stringify(data))
  try {
    fs.chmodSync(secretFile, 0o600)
  } catch {
    /* Windows 上忽略 */
  }
}

function registerSecretHandlers() {
  ipcMain.handle('secrets:get', (_event, id) => {
    const all = readSecrets()
    const entry = all[id]
    if (!entry) return null
    try {
      if (entry.encrypted && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(entry.value, 'base64'))
      }
      return Buffer.from(entry.value, 'base64').toString('utf8')
    } catch {
      return null
    }
  })

  ipcMain.handle('secrets:set', (_event, id, value) => {
    const all = readSecrets()
    const canEncrypt = safeStorage.isEncryptionAvailable()
    const encoded = canEncrypt ? safeStorage.encryptString(value).toString('base64') : Buffer.from(value, 'utf8').toString('base64')
    all[id] = { value: encoded, encrypted: canEncrypt }
    writeSecrets(all)
    return canEncrypt
  })

  ipcMain.handle('secrets:delete', (_event, id) => {
    const all = readSecrets()
    delete all[id]
    writeSecrets(all)
    return true
  })
}

function registerWorkspaceHandlers() {
  const { dialog } = require('electron')
  const { exec } = require('node:child_process')
  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'coverage', '.idea', '.vscode', 'target', '__pycache__'])

  const safeJoin = (root, rel) => {
    const target = path.resolve(root, rel)
    const base = path.resolve(root)
    if (target !== base && !target.startsWith(base + path.sep)) throw new Error('路径越界')
    return target
  }

  const walk = (root, dir, depth, out, limit) => {
    if (depth > 4 || out.length >= limit) return
    let entries = []
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
    for (const entry of entries) {
      if (out.length >= limit) return
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue
      const abs = path.join(dir, entry.name)
      const rel = path.relative(root, abs).split(path.sep).join('/')
      if (entry.isDirectory()) {
        if (IGNORE.has(entry.name)) continue
        out.push({ path: rel, name: entry.name, dir: true, depth })
        walk(root, abs, depth + 1, out, limit)
      } else {
        let size = 0
        try {
          size = fs.statSync(abs).size
        } catch {
          /* ignore */
        }
        out.push({ path: rel, name: entry.name, dir: false, depth, size })
      }
    }
  }

  ipcMain.handle('workspace:open', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择一个项目文件夹' })
    if (result.canceled || !result.filePaths.length) return null
    return { root: result.filePaths[0] }
  })

  ipcMain.handle('workspace:list', (_e, root) => {
    if (!root || !fs.existsSync(root)) return { root, entries: [], truncated: false }
    const out = []
    walk(root, root, 0, out, 600)
    return { root, entries: out, truncated: out.length >= 600 }
  })

  ipcMain.handle('workspace:read', (_e, root, rel) => {
    const abs = safeJoin(root, rel)
    const stat = fs.statSync(abs)
    if (!stat.isFile()) throw new Error('不是文件')
    if (stat.size > 2 * 1024 * 1024) return { content: '', size: stat.size, binary: false, tooLarge: true }
    const buf = fs.readFileSync(abs)
    const binary = buf.includes(0)
    return { content: binary ? '' : buf.toString('utf8'), size: stat.size, binary, tooLarge: false }
  })

  ipcMain.handle('workspace:write', (_e, root, rel, content) => {
    const abs = safeJoin(root, rel)
    fs.writeFileSync(abs, content, 'utf8')
    return { ok: true, size: Buffer.byteLength(content, 'utf8') }
  })

  const decode = (buf) => {
    if (!buf || !buf.length) return ''
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(buf)
    } catch {
      try {
        // Windows 控制台常见 GBK 输出
        return new TextDecoder('gbk').decode(buf)
      } catch {
        return buf.toString('utf8')
      }
    }
  }

  ipcMain.handle('workspace:exec', (_e, root, command) => {
    return new Promise((resolve) => {
      const started = Date.now()
      exec(
        command,
        { cwd: root, timeout: 120000, maxBuffer: 4 * 1024 * 1024, windowsHide: true, encoding: 'buffer' },
        (error, stdout, stderr) => {
          resolve({
            code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0,
            stdout: decode(stdout),
            stderr: decode(stderr),
            durationMs: Date.now() - started,
          })
        },
      )
    })
  })
}
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
      // 本地应用：允许直连用户配置的 API Base URL（跨域）
      webSecurity: false,
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
registerSecretHandlers()
registerWorkspaceHandlers()

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
