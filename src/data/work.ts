/**
 * 思祁.Work · v2.0 领域数据
 * 会话 / 模型 Provider / 模型 / 连接器 / 技能 / 用量
 * 数值与状态为原型演示数据，不代表真实账单或真机结论。
 */

export type ThemeMode = 'light' | 'dark' | 'system'
export type Density = 'lite' | 'pro'

export interface Session {
  id: string
  title: string
  project: string | null
  updatedAt: string
  status: 'idle' | 'running' | 'awaiting'
  pinned?: boolean
  preview: string
}

export type MessageRole = 'user' | 'assistant' | 'tool'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  time: string
  tools?: Array<{ name: string; detail: string; state: 'done' | 'running' | 'blocked' }>
  streaming?: boolean
}

export interface Provider {
  id: string
  name: string
  kind: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'compatible' | 'custom'
  baseUrl: string
  keyMasked: string
  enabled: boolean
  status: 'connected' | 'unverified' | 'error'
  models: string[]
  lastTest: string | null
  latencyMs: number | null
  route: 'direct' | 'proxy'
}

export interface ModelInfo {
  id: string
  name: string
  providerId: string
  contextK: number
  priceIn: number
  priceOut: number
  capabilities: Array<'文本' | '视觉' | '工具' | '结构化' | '推理'>
  enabled: boolean
  isDefault?: boolean
  capabilitySource: '供应商元数据' | '实测'
}

export interface ConnectorItem {
  id: string
  name: string
  category: '开发平台' | '文件与知识' | '通信' | '数据库' | '服务器' | '本地环境'
  status: 'connected' | 'needs_auth' | 'offline' | 'disabled'
  scopes: string
  detail: string
}

export interface SkillItem {
  id: string
  name: string
  version: string
  enabled: boolean
  scope: string
  permissions: string
}

export const sessions: Session[] = [
  { id: 's_1', title: '给 Agent 加检查点恢复', project: 'nexus-core', updatedAt: '刚刚', status: 'running', pinned: true, preview: '计划已生成，正在测试 CheckpointStore 的幂等写入…' },
  { id: 's_2', title: '整理 v2.0 规范到工程任务', project: 'sisqi-docs', updatedAt: '12 分钟前', status: 'awaiting', preview: '需要你确认 API Key 存储方案：Keystore 直连还是云端代理。' },
  { id: 's_3', title: 'Reno12 状态栏 Insets 排查', project: 'nexus-core', updatedAt: '1 小时前', status: 'idle', preview: '结论：页面背景延伸到状态栏，内容使用 safeDrawing 内边距。' },
  { id: 's_4', title: '重写会话首页的空状态', project: 'nexus-core', updatedAt: '今天 09:12', status: 'idle', preview: '空状态提供三个入口：提问、继续上次工作、导入项目。' },
  { id: 's_5', title: 'OpenAI Compatible 接入说明', project: null, updatedAt: '昨天', status: 'idle', preview: '自定义 Base URL、协议类型、认证头与模型列表的配置步骤。' },
]

export const initialMessages: ChatMessage[] = [
  {
    id: 'm1',
    role: 'user',
    content: '给 Agent 加上检查点恢复：任务中断后能从最近一次检查点继续，不能重复执行已经完成的工具调用。',
    time: '14:02',
  },
  {
    id: 'm2',
    role: 'assistant',
    content:
      '收到。目标记下了：中断可恢复、恢复不重复副作用、回归测试通过。我先检查现有 Harness 的事件与检查点结构，再给出计划。',
    time: '14:02',
    tools: [
      { name: 'read_file', detail: 'core/agent/harness/AgentLoop.kt · CheckpointStore.kt', state: 'done' },
      { name: 'grep', detail: 'checkpoint|sequence · 12 处命中', state: 'done' },
    ],
  },
  {
    id: 'm3',
    role: 'assistant',
    content:
      '计划：\n1. 保存检查点时写入事件序列号与文件内容哈希；\n2. 恢复时按序列号重放，已执行的工具调用直接复用结果；\n3. 为并发写入补一个「后写胜出但仍幂等」的用例；\n4. 回归 :core:agent 与 :core:sync。\n\n我先在第 2、3 步之间加一层事件去重表，然后跑测试。',
    time: '14:03',
  },
  {
    id: 'm4',
    role: 'tool',
    content: 'gradle :core:agent:test --rerun → 34 passed · 1 failed · 2 skipped（concurrentSaveKeepsLatest 失败：期望 1 次写入，实际 2 次）',
    time: '14:24',
    tools: [{ name: 'run_tests', detail: 'sbx-eu-03 · 41s · 退出码 1', state: 'blocked' }],
  },
  {
    id: 'm5',
    role: 'assistant',
    content:
      '失败原因已定位：并发保存时两个协程都读到了旧序列号。修复方式是给检查点写入加互斥并对序列号做 CAS，失败方重读后重试一次。要我直接改，还是先只给出补丁让你审？',
    time: '14:25',
  },
]

export const providers: Provider[] = [
  {
    id: 'p_openai',
    name: 'OpenAI',
    kind: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    keyMasked: 'sk-••••••••••••7f3a',
    enabled: true,
    status: 'connected',
    models: ['gpt-5.2', 'gpt-5.2-mini'],
    lastTest: '今天 13:40',
    latencyMs: 412,
    route: 'direct',
  },
  {
    id: 'p_anthropic',
    name: 'Anthropic',
    kind: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    keyMasked: 'sk-ant-••••••3c21',
    enabled: true,
    status: 'connected',
    models: ['claude-opus-4.6', 'claude-sonnet-4.6'],
    lastTest: '今天 12:05',
    latencyMs: 638,
    route: 'direct',
  },
  {
    id: 'p_deepseek',
    name: 'DeepSeek',
    kind: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    keyMasked: 'sk-••••••••••••b90e',
    enabled: true,
    status: 'unverified',
    models: ['deepseek-reasoner'],
    lastTest: null,
    latencyMs: null,
    route: 'direct',
  },
  {
    id: 'p_gemini',
    name: 'Google Gemini',
    kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    keyMasked: 'AIza••••••••••••',
    enabled: false,
    status: 'error',
    models: ['gemini-3-pro'],
    lastTest: '昨天 22:14',
    latencyMs: null,
    route: 'proxy',
  },
  {
    id: 'p_custom',
    name: '自建 Compatible',
    kind: 'compatible',
    baseUrl: 'https://llm.sisqi.internal/v1',
    keyMasked: 'sk-••••••••••••02fd',
    enabled: true,
    status: 'connected',
    models: ['qwen3-coder', 'glm-5'],
    lastTest: '今天 09:31',
    latencyMs: 188,
    route: 'proxy',
  },
]

export const models: ModelInfo[] = [
  { id: 'm_gpt52', name: 'gpt-5.2', providerId: 'p_openai', contextK: 400, priceIn: 1.25, priceOut: 10, capabilities: ['文本', '视觉', '工具', '结构化', '推理'], enabled: true, isDefault: true, capabilitySource: '供应商元数据' },
  { id: 'm_gpt52mini', name: 'gpt-5.2-mini', providerId: 'p_openai', contextK: 200, priceIn: 0.25, priceOut: 2, capabilities: ['文本', '工具', '结构化'], enabled: true, capabilitySource: '供应商元数据' },
  { id: 'm_opus', name: 'claude-opus-4.6', providerId: 'p_anthropic', contextK: 200, priceIn: 15, priceOut: 75, capabilities: ['文本', '视觉', '工具', '推理'], enabled: true, capabilitySource: '供应商元数据' },
  { id: 'm_sonnet', name: 'claude-sonnet-4.6', providerId: 'p_anthropic', contextK: 200, priceIn: 3, priceOut: 15, capabilities: ['文本', '视觉', '工具'], enabled: true, capabilitySource: '供应商元数据' },
  { id: 'm_ds', name: 'deepseek-reasoner', providerId: 'p_deepseek', contextK: 128, priceIn: 0.55, priceOut: 2.19, capabilities: ['文本', '推理'], enabled: true, capabilitySource: '实测' },
  { id: 'm_gemini', name: 'gemini-3-pro', providerId: 'p_gemini', contextK: 1000, priceIn: 1.25, priceOut: 10, capabilities: ['文本', '视觉', '工具'], enabled: false, capabilitySource: '供应商元数据' },
  { id: 'm_qwen', name: 'qwen3-coder', providerId: 'p_custom', contextK: 256, priceIn: 0.3, priceOut: 1.2, capabilities: ['文本', '工具'], enabled: true, capabilitySource: '实测' },
]

export const connectors: ConnectorItem[] = [
  { id: 'c_github', name: 'GitHub', category: '开发平台', status: 'connected', scopes: 'repo:read, pull_request:write', detail: '2 个仓库已授权' },
  { id: 'c_gitlab', name: 'GitLab', category: '开发平台', status: 'needs_auth', scopes: 'api', detail: 'Token 已过期，需要重新授权' },
  { id: 'c_notion', name: 'Notion', category: '文件与知识', status: 'connected', scopes: 'read_content', detail: '工作区：SISQI' },
  { id: 'c_pg', name: 'PostgreSQL', category: '数据库', status: 'connected', scopes: 'read-only', detail: 'dev-cluster · 只读账号' },
  { id: 'c_ssh', name: 'SSH / SFTP', category: '服务器', status: 'connected', scopes: 'edge-01, build-02', detail: '主机密钥已校验' },
  { id: 'c_docker', name: 'Docker', category: '服务器', status: 'offline', scopes: 'local daemon', detail: '未检测到可用 Docker（Android 本地不支持）' },
  { id: 'c_mcp', name: 'MCP Server · filesystem', category: '本地环境', status: 'connected', scopes: 'workspace', detail: '受限目录：~/projects' },
  { id: 'c_slack', name: 'Slack', category: '通信', status: 'disabled', scopes: 'chat:write', detail: '已在设置中停用' },
]

export const skills: SkillItem[] = [
  { id: 's_android', name: 'Android Development', version: '2.3.0', enabled: true, scope: '项目级', permissions: '读文件 · 执行 Gradle' },
  { id: 's_compose', name: 'Compose UI', version: '1.8.2', enabled: true, scope: '项目级', permissions: '读文件' },
  { id: 's_audit', name: 'UI/UX Audit', version: '1.2.0', enabled: true, scope: '全局', permissions: '读文件 · 截图' },
  { id: 's_review', name: 'Code Review', version: '3.0.1', enabled: true, scope: '全局', permissions: '读文件 · Diff' },
  { id: 's_ssh', name: 'SSH Ops', version: '0.9.4', enabled: false, scope: '设备级', permissions: '网络 · 执行命令' },
]

export const usage = {
  period: '近 7 天',
  requests: 1284,
  inputTokens: 2_940_000,
  outputTokens: 612_000,
  costUsd: 18.42,
  costSource: '估算值（按 Provider 单价计算）',
  avgLatencyMs: 936,
  successRate: 98.6,
  byModel: [
    { model: 'gpt-5.2', requests: 512, tokens: 1_480_000, cost: 9.12, share: 40 },
    { model: 'claude-opus-4.6', requests: 214, tokens: 620_000, cost: 5.86, share: 17 },
    { model: 'claude-sonnet-4.6', requests: 331, tokens: 980_000, cost: 3.02, share: 26 },
    { model: 'qwen3-coder', requests: 227, tokens: 472_000, cost: 0.42, share: 17 },
  ],
}

export const contextUsage = { usedK: 46, maxK: 200, messages: 12, toolResults: 5 }

export const recentActivity = [
  { at: '14:25', text: 'Agent 修复失败用例 restoreAfterInterruptedRun', tone: 'accent' as const },
  { at: '14:24', text: '测试 34 通过 · 1 失败 · 2 跳过', tone: 'warn' as const },
  { at: '14:11', text: '检查点 ckpt_0004 已保存（5 个文件）', tone: 'muted' as const },
  { at: '13:43', text: '等待审批：读取 Pad 本地 Build 属性', tone: 'warn' as const },
]
