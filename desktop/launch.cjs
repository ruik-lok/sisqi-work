/**
 * 启动器：用子进程拉起 Electron，并在启动前清掉 ELECTRON_RUN_AS_NODE。
 * 某些环境（含本机）会预设该变量，导致 Electron 以 Node 模式执行并立刻退出。
 */
const { spawn } = require('node:child_process')
const path = require('node:path')

const electron = require('electron')
const appDir = path.join(__dirname, '..')

const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

const child = spawn(electron, [appDir, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  windowsHide: false,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
