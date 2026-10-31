import http from 'node:http'

const PORT = Number(process.env.PORT || 4899)
const REPLY = ['你好，', '我是运行在本机的 ', 'OpenAI 兼容 mock 模型。', '这条回复是真的通过 ', 'HTTP + SSE ', '流式返回的。']

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end()
    return
  }

  if (req.method === 'GET' && req.url?.endsWith('/models')) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ data: [{ id: 'mock-model' }, { id: 'mock-model-mini' }] }))
    return
  }

  if (req.method === 'POST' && req.url?.includes('/chat/completions')) {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const auth = req.headers.authorization || ''
      if (!auth.startsWith('Bearer sk-mock')) {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: { message: 'invalid key' } }))
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      let i = 0
      const timer = setInterval(() => {
        if (i < REPLY.length) {
          res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: REPLY[i] } }] })}\n\n`)
          i += 1
          return
        }
        res.write(`data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 42, completion_tokens: 18, total_tokens: 60 } })}\n\n`)
        res.write('data: [DONE]\n\n')
        res.end()
        clearInterval(timer)
      }, 120)
      res.on('close', () => clearInterval(timer))
    })
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: { message: 'not found' } }))
})

server.listen(PORT, '127.0.0.1', () => console.log(`mock llm on http://127.0.0.1:${PORT}`))
