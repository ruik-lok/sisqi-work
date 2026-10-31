import { writeFileSync } from 'node:fs'

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
await send('Page.enable')
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (res.result?.exceptionDetails) return { error: res.result.exceptionDetails.exception?.description ?? res.result.exceptionDetails.text }
  return res.result?.result?.value
}
const shot = async (path) => {
  const res = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(res.result.data, 'base64'))
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const root = String.raw`C:\Users\Administrator\Documents\deepseek-harness\default-workspace\test-workspace`
const results = []
const check = (name, ok, extra = '') => results.push({ name, ok, extra })

await evaluate(`localStorage.setItem('sisqi.workspace.root', ${JSON.stringify(root)}); location.href = './index.html?mode=desktop&pad=projects'`)
await sleep(2500)
check('文件树渲染', (await evaluate(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('README.md'))`)) === true)

await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('README.md'))?.click()`)
await sleep(900)
const editorValue = await evaluate(`document.querySelector('textarea[aria-label="文件编辑器"]')?.value ?? ''`)
check('打开文件内容正确', String(editorValue).includes('hello from real workspace'))

// 编辑并保存
await evaluate(`(() => {
  const ta = document.querySelector('textarea[aria-label="文件编辑器"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
  setter.call(ta, ta.value + '\\n// edited by UI test')
  ta.dispatchEvent(new Event('input', { bubbles: true }))
})()`)
await sleep(500)
check('出现未保存状态', (await evaluate(`document.body.textContent.includes('未保存')`)) === true)
await evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '保存')?.click()`)
await sleep(900)
check('保存后未保存标记消失', (await evaluate(`!document.body.textContent.includes('未保存')`)) === true)

// 终端执行
await evaluate(`(() => {
  const input = document.querySelector('input[aria-label="终端命令"]')
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  setter.call(input, 'echo from-terminal')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
})()`)
await sleep(1200)
check('终端输出可见', (await evaluate(`document.body.textContent.includes('from-terminal')`)) === true)

await shot('shots/ws-01.png')
console.log(results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' — ' + r.extra : ''}`).join('\n'))
process.exit(results.every((r) => r.ok) ? 0 : 1)
