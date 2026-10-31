import { chromium } from 'playwright-core'

const BASE = 'http://127.0.0.1:4317/'
const browser = await chromium.connectOverCDP('http://127.0.0.1:9344')
const page = browser.contexts()[0].pages()[0]
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => (m.type() === 'error' ? errors.push(m.text()) : null))

const out = []
const check = (name, ok, extra = '') => out.push({ name, ok, extra })

await page.setViewportSize({ width: 1600, height: 1000 })
await page.goto(BASE + '?mode=pad&theme=dark&pad=settings&section=models', { waitUntil: 'load' })
await page.evaluate(() => {
  localStorage.clear()
})
await page.reload({ waitUntil: 'load' })
await page.waitForTimeout(900)

// 1) 添加 Provider
await page.getByRole('button', { name: '添加 Provider' }).click()
await page.waitForTimeout(300)
await page.getByPlaceholder('例如：OpenAI / 自建网关').fill('本地 Mock')
await page.getByPlaceholder('https://api.openai.com/v1').fill('http://127.0.0.1:4899/v1')
await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
await page.waitForTimeout(400)

// 2) 写入密钥
await page.getByPlaceholder('sk-...').fill('sk-mock-123456')
await page.getByRole('dialog').getByRole('button', { name: '保存' }).click()
await page.waitForTimeout(600)
check('Provider 与密钥已保存', (await page.getByText('本地 Mock').count()) > 0)

// 3) 连接测试（真实请求本地 mock）
const mockCard = page.locator('section', { hasText: '本地 Mock' }).last()
await mockCard.getByRole('button', { name: '连接测试' }).click()
await page.waitForTimeout(1500)
check('连接测试成功', (await page.getByRole('status').filter({ hasText: '连接成功' }).count()) > 0)
check('模型列表已拉取', (await mockCard.getByText(/mock-model/).count()) > 0)

// 4) 添加模型并设为当前
await page.getByRole('button', { name: '添加模型' }).click()
await page.waitForTimeout(300)
await page.getByPlaceholder('gpt-5.2').fill('mock-model')
const dialog = page.getByRole('dialog')
await dialog.locator('select').selectOption({ label: '本地 Mock' })
await dialog.getByRole('button', { name: '保存' }).click()
await page.waitForTimeout(600)
check('模型已添加', (await page.getByRole('cell', { name: /mock-model/ }).count()) > 0)

// 5) 回到会话，选择 mock 模型并发送
await page.goto(BASE + '?mode=pad&theme=dark&pad=chat', { waitUntil: 'load' })
await page.waitForTimeout(800)
await page.getByRole('button', { name: '选择模型' }).click()
await page.waitForTimeout(300)
const option = page.getByRole('menuitem', { name: /mock-model/ }).first()
await option.click()
await page.waitForTimeout(300)
check('未配置密钥提示消失', (await page.getByText(/演示模式：这个 Provider 还没有 API Key/).count()) === 0)

await page.getByLabel('消息输入').fill('用一句话打招呼')
await page.getByLabel('消息输入').press('Enter')
await page.waitForTimeout(2200)
check('真实流式回复到达', (await page.getByText(/OpenAI 兼容 mock 模型/).count()) > 0)
check('没有错误横幅', (await page.getByText(/请求失败/).count()) === 0)

const usage = await page.evaluate(() => {
  const raw = localStorage.getItem('sisqi.state.v2')
  return raw ? JSON.parse(raw).usage : null
})
check('用量已累计', Boolean(usage && usage.requests >= 1 && usage.promptTokens >= 42), JSON.stringify(usage))

await page.screenshot({ path: 'shots/live-03-live-chat.png' })

console.log(out.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? ' — ' + r.extra : ''}`).join('\n'))
console.log('errors:', errors.length ? errors : 'none')
process.exit(out.every((r) => r.ok) && errors.length === 0 ? 0 : 1)
