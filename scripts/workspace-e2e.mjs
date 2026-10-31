const list = await (await fetch('http://127.0.0.1:9334/json/list')).json()
const page = list.find((p) => p.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res) => (ws.onopen = res))
let id = 0
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const mid = ++id
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id === mid) {
        ws.removeEventListener('message', onMsg)
        resolve(msg)
      }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id: mid, method, params }))
  })

await send('Runtime.enable')
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.text + ' ' + (res.result.exceptionDetails.exception?.description ?? '') }
  return res.result?.result?.value
}

const root = String.raw`C:\Users\Administrator\Documents\deepseek-harness\default-workspace\test-workspace`
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok, extra })

check('desktop bridge 存在', await evaluate('Boolean(window.sisqi?.desktop && window.sisqi.workspace)'))

const listing = await evaluate(`window.sisqi.workspace.list(${JSON.stringify(root)})`)
const paths = listing.entries.map((e) => e.path)
check('列出目录并跳过 node_modules', paths.includes('src/main.ts') && !paths.some((p) => p.startsWith('node_modules')), paths.slice(0, 6).join(', '))

const read = await evaluate(`window.sisqi.workspace.read(${JSON.stringify(root)}, 'README.md')`)
check('读取文件', read.content.includes('hello from real workspace'), String(read.content).slice(0, 30))

const write = await evaluate(`window.sisqi.workspace.write(${JSON.stringify(root)}, 'src/note.txt', 'written by dsh test')`)
const readBack = await evaluate(`window.sisqi.workspace.read(${JSON.stringify(root)}, 'src/note.txt')`)
check('写入并读回', write.ok && readBack.content === 'written by dsh test')

const escape = await evaluate(`window.sisqi.workspace.read(${JSON.stringify(root)}, '../../secret.txt').then(() => 'allowed').catch((e) => 'blocked')`)
check('越界路径被拒绝', escape === 'blocked', escape)

const exec = await evaluate(`window.sisqi.workspace.exec(${JSON.stringify(root)}, 'echo hello-real-workspace')`)
check('执行命令', exec.code === 0 && exec.stdout.includes('hello-real-workspace'), `${exec.code} · ${exec.durationMs}ms`)

const git = await evaluate(`window.sisqi.workspace.exec(${JSON.stringify(root)}, 'git status --short')`)
check('git 命令可用', typeof git.code === 'number', String(git.stdout).slice(0, 60))

console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' — ' + r.extra : ''}`).join('\n'))
process.exit(results.every((r) => r.ok) ? 0 : 1)
