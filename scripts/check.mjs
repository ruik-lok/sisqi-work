import { chromium } from 'playwright-core'

const scenario = process.env.SCENARIO || 'approval'
const browser = await chromium.connectOverCDP('http://127.0.0.1:9344')
const ctx = browser.contexts()[0]
const page = ctx.pages()[0]
await page.setViewportSize({ width: 1600, height: 1000 })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

const results = []
const check = (name, ok, extra = '') => results.push({ name, ok, extra })

if (scenario === 'approval') {
  await page.goto('http://127.0.0.1:4317/?mode=pad&pad=agent&task=T-2479', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  check('任务已选中', (await page.getByText('补齐 Reno12 设备画像 ABI 与 RAM 字段采集').count()) > 0)
  await page.getByRole('button', { name: /查看并批准/ }).first().click()
  await page.waitForTimeout(500)
  check('审批对话框出现', (await page.getByRole('dialog', { name: /批准一次设备读取/ }).count()) > 0)
  await page.getByRole('button', { name: /^批准$/ }).click()
  await page.waitForTimeout(700)
  const toast = await page.getByRole('status').first().innerText()
  check('批准后有反馈', /已授权本次调用/.test(toast), toast.replace(/\n/g, ' | '))
}

if (scenario === 'chat') {
  await page.goto('http://127.0.0.1:4317/?mode=pad&pad=chat', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  const input = page.getByLabel('消息输入')
  await input.click()
  await input.fill('先给出计划，再开始执行')
  await input.press('Enter')
  await page.waitForTimeout(600)
  check('用户消息已发送', (await page.getByText('先给出计划，再开始执行').count()) > 0)
  await page.waitForTimeout(1600)
  check('出现流式回复', (await page.getByText('停止生成').count()) > 0)
  await page.getByRole('button', { name: /停止生成/ }).click()
  await page.waitForTimeout(400)
  check('可停止生成', (await page.getByText('停止生成').count()) === 0)
  await page.screenshot({ path: 'shots/v2-chat.png' })
}

if (scenario === 'palette') {
  await page.goto('http://127.0.0.1:4317/?mode=pad&pad=chat', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+K')
  await page.waitForTimeout(400)
  check('命令面板打开', (await page.getByRole('dialog', { name: '命令面板' }).count()) > 0)
  const q = page.getByLabel('搜索命令')
  await q.click()
  await q.fill('模型')
  await page.waitForTimeout(300)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  check('跳转到模型与 API', (await page.getByRole('heading', { name: '模型与 API' }).count()) > 0)
}

if (scenario === 'theme') {
  await page.goto('http://127.0.0.1:4317/?mode=pad&pad=chat', { waitUntil: 'load' })
  await page.waitForTimeout(1000)
  await page.locator('header button[aria-expanded]').last().click()
  await page.waitForTimeout(300)
  await page.getByRole('menuitem', { name: /Arctic Blue/ }).click()
  await page.waitForTimeout(700)
  const theme = await page.evaluate(() => document.documentElement.dataset.theme)
  check('切换为 Arctic Blue', theme === 'light', String(theme))
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  check('亮色背景生效', bg.includes('244') || bg.includes('247'), bg)
  await page.screenshot({ path: 'shots/v2-light.png' })
}

if (scenario === 'projects') {
  await page.goto('http://127.0.0.1:4317/?mode=pad&pad=projects', { waitUntil: 'load' })
  await page.waitForTimeout(1200)
  check('项目页出现编辑器', (await page.locator('[role="code"]').count()) > 0)
  await page.getByRole('button', { name: /变更 3/ }).click()
  await page.waitForTimeout(400)
  check('变更面板显示文件', (await page.getByText('core/terminal/PtySession.kt').count()) > 0)
  await page.getByRole('button', { name: '审查' }).first().click()
  await page.waitForTimeout(600)
  check('Diff 对话框打开', (await page.getByRole('dialog', { name: /变更审查/ }).count()) > 0)
  await page.getByRole('button', { name: '接受' }).first().click()
  await page.waitForTimeout(300)
  check('可按文件接受', (await page.getByRole('button', { name: '已接受' }).count()) > 0)
}

console.log(`\n[${scenario}]`)
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' — ' + r.extra : ''}`)
console.log('page errors:', errors.length ? errors : 'none')
process.exit(results.every((r) => r.ok) && errors.length === 0 ? 0 : 1)
