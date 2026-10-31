/**
 * NEXUS demo domain model.
 * Field vocabulary mirrors 05_接口与数据协议/数据模型与状态机.md.
 * Unknown device facts are intentionally `null` and rendered as 待检测 — never guessed.
 */

export type CapabilityStatus =
  | 'Planned'
  | 'Implementing'
  | 'Implemented'
  | 'Verified'
  | 'Blocked'
  | 'Not Supported'

export type TaskStatus =
  | 'QUEUED'
  | 'PREPARING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'PAUSED'
  | 'TESTING'
  | 'REVIEWING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'

export type ExecutionTarget = 'CLOUD_SANDBOX' | 'PAD_LOCAL' | 'PHONE_LOCAL' | 'REMOTE_SSH'

export type DeviceStatus =
  | 'ENROLLING'
  | 'ONLINE'
  | 'IDLE'
  | 'BUSY'
  | 'BACKGROUND'
  | 'OFFLINE'
  | 'NEEDS_APPROVAL'
  | 'ERROR'
  | 'REVOKED'

export interface Device {
  id: string
  name: string
  kind: 'phone' | 'tablet' | 'cloud' | 'server'
  status: DeviceStatus
  model: string | null
  deviceCode: string | null
  androidApi: number | null
  coloros: string | null
  abi: string | null
  totalRamMb: number | null
  availableRamMb: number | null
  rootProvider: string | null
  rootAvailable: boolean | null
  selinuxEnforcing: boolean | null
  fingerprint: string | null
  lastSeen: string
  role: string
  profileVersion: number
  capabilities: Array<{ label: string; status: CapabilityStatus; note?: string }>
}

export interface Project {
  id: string
  name: string
  repository: string
  defaultBranch: string
  language: string
  latestSnapshot: string
  updatedAt: string
  dirty: number
}

export interface FileNode {
  path: string
  name: string
  depth: number
  kind: 'dir' | 'file'
  status?: 'modified' | 'added' | 'untracked'
  lang?: string
}

export interface CodeFile {
  path: string
  lang: string
  code: string
  dirty?: boolean
}

export interface TaskEvent {
  sequence: number
  type: string
  label: string
  detail?: string
  timestamp: string
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent'
}

export interface Task {
  id: string
  projectId: string
  title: string
  status: TaskStatus
  stage: string
  target: ExecutionTarget
  agentRole: string
  branch: string
  checkpoint: string
  createdAt: string
  updatedAt: string
  budget: { tokensUsed: number; tokensMax: number; costUsd: number; costMaxUsd: number; minutes: number; minutesMax: number; tools: number; toolsMax: number }
  progress: number
  testSummary: { passed: number; failed: number; skipped: number } | null
  diffSummary: { files: number; additions: number; deletions: number } | null
  events: TaskEvent[]
  awaitingApprovalId?: string
  risk?: 'low' | 'medium' | 'high'
}

export interface Approval {
  id: string
  taskId: string
  deviceId: string
  capability: string
  operation: string
  risk: 'low' | 'medium' | 'high'
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED'
  expiresInSec: number
  requestedBy: string
}

export interface DiffFile {
  path: string
  lang: string
  additions: number
  deletions: number
  hunks: Array<{ header: string; lines: Array<{ kind: 'ctx' | 'add' | 'del'; text: string }> }>
}

export const devices: Device[] = [
  {
    id: 'dev_reno12',
    name: 'Reno12 5G',
    kind: 'phone',
    status: 'ONLINE',
    model: 'PJZ110',
    deviceCode: null,
    androidApi: null,
    coloros: '16',
    abi: 'arm64-v8a',
    totalRamMb: null,
    availableRamMb: null,
    rootProvider: null,
    rootAvailable: true,
    selinuxEnforcing: null,
    fingerprint: null,
    lastSeen: '12 秒前',
    role: '移动控制中心 · 审批 · 远程终端',
    profileVersion: 3,
    capabilities: [
      { label: 'Compose UI', status: 'Implementing' },
      { label: 'PTY', status: 'Implementing', note: '交互回归待跑' },
      { label: 'SSH / SFTP', status: 'Verified', note: '2026-10-28 真机日志' },
      { label: 'Git', status: 'Verified' },
      { label: 'Termux Userland', status: 'Planned', note: '仅轻量验证' },
      { label: 'Root Helper', status: 'Implementing', note: 'Provider 待检测' },
    ],
  },
  {
    id: 'dev_pad',
    name: 'OPPO Pad Pro',
    kind: 'tablet',
    status: 'BUSY',
    model: null,
    deviceCode: null,
    androidApi: null,
    coloros: '14',
    abi: 'arm64-v8a',
    totalRamMb: 8192,
    availableRamMb: 2740,
    rootProvider: null,
    rootAvailable: true,
    selinuxEnforcing: null,
    fingerprint: null,
    lastSeen: '正在采集',
    role: '主力本地开发 · 编辑 · 轻中型构建',
    profileVersion: 2,
    capabilities: [
      { label: 'Compose UI', status: 'Implementing' },
      { label: 'PTY', status: 'Implementing' },
      { label: 'SSH / SFTP', status: 'Verified' },
      { label: 'proot-distro', status: 'Planned', note: '重点验证项' },
      { label: '本地多 Agent', status: 'Not Supported', note: '8GB 预算不允许' },
      { label: 'Root Helper', status: 'Planned', note: 'Provider 与手机不同' },
    ],
  },
  {
    id: 'dev_cloud',
    name: 'Cloud Sandbox',
    kind: 'cloud',
    status: 'ONLINE',
    model: 'ubuntu-24.04 / arm64',
    deviceCode: 'sbx-eu-03',
    androidApi: null,
    coloros: null,
    abi: 'aarch64',
    totalRamMb: 16384,
    availableRamMb: 11920,
    rootProvider: 'sandbox-root',
    rootAvailable: true,
    selinuxEnforcing: null,
    fingerprint: null,
    lastSeen: '4 秒前',
    role: '长任务 · 多 Agent · 隔离构建',
    profileVersion: 5,
    capabilities: [
      { label: 'Sandbox 执行', status: 'Verified' },
      { label: '断线续跑', status: 'Verified', note: '离线 12 分钟无事件丢失' },
      { label: '多 Agent 并行', status: 'Implementing' },
      { label: 'MCP 连接器', status: 'Planned' },
    ],
  },
  {
    id: 'dev_server',
    name: 'edge-01 (SSH)',
    kind: 'server',
    status: 'IDLE',
    model: 'Debian 12 / x86_64',
    deviceCode: null,
    androidApi: null,
    coloros: null,
    abi: 'x86_64',
    totalRamMb: 32768,
    availableRamMb: 28110,
    rootProvider: null,
    rootAvailable: null,
    selinuxEnforcing: null,
    fingerprint: null,
    lastSeen: '2 分钟前',
    role: '自有服务器 · 构建缓存 · 端口转发',
    profileVersion: 4,
    capabilities: [
      { label: 'SSH Host Key 校验', status: 'Verified' },
      { label: '端口转发', status: 'Implementing' },
      { label: '构建缓存代理', status: 'Verified' },
    ],
  },
]

export const projects: Project[] = [
  {
    id: 'p_nexus_core',
    name: 'nexus-core',
    repository: 'git@nexus.dev:app/nexus-core.git',
    defaultBranch: 'main',
    language: 'Kotlin',
    latestSnapshot: 'snap_0f3a · content-hash 校验通过',
    updatedAt: '12 分钟前',
    dirty: 4,
  },
  {
    id: 'p_orbit',
    name: 'orbit-api',
    repository: 'git@nexus.dev:cloud/orbit-api.git',
    defaultBranch: 'main',
    language: 'TypeScript',
    latestSnapshot: 'snap_9c21',
    updatedAt: '1 小时前',
    dirty: 0,
  },
  {
    id: 'p_notes',
    name: 'field-notes',
    repository: 'git@nexus.dev:me/field-notes.git',
    defaultBranch: 'main',
    language: 'Markdown',
    latestSnapshot: 'snap_71de',
    updatedAt: '昨天',
    dirty: 0,
  },
]

export const fileTree: FileNode[] = [
  { path: 'app', name: 'app', depth: 0, kind: 'dir' },
  { path: 'app/src/main/kotlin/dev/nexus/app', name: 'dev.nexus.app', depth: 1, kind: 'dir' },
  { path: 'app/src/main/kotlin/dev/nexus/app/MainActivity.kt', name: 'MainActivity.kt', depth: 2, kind: 'file', lang: 'kotlin' },
  { path: 'core/agent', name: 'core.agent', depth: 0, kind: 'dir' },
  { path: 'core/agent/harness', name: 'harness', depth: 1, kind: 'dir' },
  { path: 'core/agent/harness/AgentLoop.kt', name: 'AgentLoop.kt', depth: 2, kind: 'file', lang: 'kotlin', status: 'modified' },
  { path: 'core/agent/harness/CheckpointStore.kt', name: 'CheckpointStore.kt', depth: 2, kind: 'file', lang: 'kotlin' },
  { path: 'core/agent/tools', name: 'tools', depth: 1, kind: 'dir' },
  { path: 'core/agent/tools/ToolRegistry.kt', name: 'ToolRegistry.kt', depth: 2, kind: 'file', lang: 'kotlin', status: 'modified' },
  { path: 'core/terminal', name: 'core.terminal', depth: 0, kind: 'dir' },
  { path: 'core/terminal/PtySession.kt', name: 'PtySession.kt', depth: 1, kind: 'file', lang: 'kotlin', status: 'modified' },
  { path: 'core/terminal/PtySessionTest.kt', name: 'PtySessionTest.kt', depth: 1, kind: 'file', lang: 'kotlin', status: 'added' },
  { path: 'feature/tasks', name: 'feature.tasks', depth: 0, kind: 'dir' },
  { path: 'feature/tasks/TaskDetailScreen.kt', name: 'TaskDetailScreen.kt', depth: 1, kind: 'file', lang: 'kotlin' },
  { path: 'gradle/libs.versions.toml', name: 'libs.versions.toml', depth: 0, kind: 'file', lang: 'toml' },
  { path: 'README.md', name: 'README.md', depth: 0, kind: 'file', lang: 'markdown' },
]

export const codeFiles: CodeFile[] = [
  {
    path: 'core/agent/harness/AgentLoop.kt',
    lang: 'kotlin',
    dirty: true,
    code: `package dev.nexus.core.agent.harness

import dev.nexus.core.agent.model.ModelAdapter
import dev.nexus.core.agent.policy.PolicyEngine
import dev.nexus.core.agent.tools.ToolRegistry

/**
 * 单 Agent 执行闭环。
 * 每次迭代都必须产出可恢复的 Checkpoint；禁止只返回「已完成」。
 */
class AgentLoop(
    private val model: ModelAdapter,
    private val tools: ToolRegistry,
    private val policy: PolicyEngine,
    private val checkpoints: CheckpointStore,
    private val events: EventPublisher,
) {
    suspend fun run(task: TaskContext): TaskOutcome {
        var iteration = 0
        while (iteration < task.budget.maxIterations) {
            iteration += 1
            val decision = model.next(task.prompt(), tools.specs())

            when (decision) {
                is Decision.CallTool -> {
                    val call = policy.validate(decision.call) // 默认拒绝
                    events.publish(TaskEvent.ToolStarted(call.id, call.name))
                    val result = tools.execute(call)
                    events.publish(TaskEvent.ToolFinished(call.id, result.ok))
                    task.observe(result)
                }

                is Decision.Stop -> {
                    val evidence = task.evidence()
                    checkpoints.save(Checkpoint(iteration, task.diff(), evidence))
                    return evidence.toOutcome()
                }
            }
        }
        return TaskOutcome.Exhausted(iteration)
    }
}`,
  },
  {
    path: 'core/agent/tools/ToolRegistry.kt',
    lang: 'kotlin',
    dirty: true,
    code: `package dev.nexus.core.agent.tools

/**
 * 工具分级：Read / Write / Execute / Network / Device:Request / Privileged:Request。
 * 所有调用统一经过权限检查、参数校验与审计，Agent 不得绕过。
 */
class ToolRegistry(
    private val policy: PolicyEngine,
    private val audit: AuditSink,
) {
    private val tools: MutableMap<String, Tool> = mutableMapOf()

    fun register(tool: Tool) {
        require(tools.put(tool.name, tool) == null) { "duplicate tool \${tool.name}" }
    }

    suspend fun execute(call: ToolCall): ToolResult {
        val tool = tools[call.name] ?: return ToolResult.UnknownTool(call.name)
        val decision = policy.check(call, tool.capability)
        audit.record(AuditRecord.attempt(call, decision))
        return when (decision) {
            is PolicyDecision.Allow -> tool.invoke(call.arguments)
            is PolicyDecision.RequireApproval -> ToolResult.NeedsApproval(decision.request)
            is PolicyDecision.Deny -> ToolResult.Denied(decision.reason)
        }
    }
}`,
  },
  {
    path: 'core/terminal/PtySession.kt',
    lang: 'kotlin',
    dirty: true,
    code: `package dev.nexus.core.terminal

/** PTY 会话：退出时必须释放 fd、注销 registry 并广播 SESSION_EXITED。 */
class PtySession(
    private val id: SessionId,
    private val pty: Pty,
    private val registry: TerminalRegistry,
) : Closeable {
    private val closed = AtomicBoolean(false)

    suspend fun read(): Frame = withContext(Dispatchers.IO) { pty.readFrames() }

    override fun close() {
        if (!closed.compareAndSet(false, true)) return
        pty.close()
        registry.remove(id)
        events.publish(TerminalEvent.SessionExited(id))
    }
}`,
  },
  {
    path: 'feature/tasks/TaskDetailScreen.kt',
    lang: 'kotlin',
    code: `package dev.nexus.feature.tasks

@Composable
fun TaskDetailScreen(taskId: String, vm: TaskDetailViewModel = hiltViewModel()) {
    val state by vm.state.collectAsStateWithLifecycle()
    NexusScaffold(title = state.task?.title ?: "任务") { padding ->
        LazyColumn(Modifier.padding(padding)) {
            item { StageTimeline(state.task?.stages.orEmpty()) }
            item { BudgetBar(state.task?.budget) }
            item { TaskEventList(state.events) }
            state.approval?.let { approval -> item { ApprovalCard(approval, vm::decide) } }
            state.diff?.let { diff -> item { DiffSummary(diff, vm::openReview) } }
        }
    }
}`,
  },
]

export const initialTasks: Task[] = [
  {
    id: 'T-2481',
    projectId: 'p_nexus_core',
    title: '为 Agent Harness 增加检查点恢复',
    status: 'TESTING',
    stage: 'TESTING',
    target: 'CLOUD_SANDBOX',
    agentRole: 'Developer → Tester',
    branch: 'agent/harness-checkpoint',
    checkpoint: 'ckpt_0007',
    createdAt: '今天 14:02',
    updatedAt: '18 秒前',
    budget: { tokensUsed: 214_800, tokensMax: 350_000, costUsd: 0.62, costMaxUsd: 1.0, minutes: 23, minutesMax: 40, tools: 41, toolsMax: 60 },
    progress: 68,
    testSummary: { passed: 34, failed: 1, skipped: 2 },
    diffSummary: { files: 5, additions: 186, deletions: 42 },
    events: [
      { sequence: 1, type: 'TASK_CREATED', label: '任务已创建', detail: 'target=CLOUD_SANDBOX · budget=350k tokens', timestamp: '14:02:11' },
      { sequence: 2, type: 'PLAN_READY', label: '计划生成', detail: '4 个验收条件：可恢复、幂等、无事件丢失、回归通过', timestamp: '14:02:26', tone: 'accent' },
      { sequence: 3, type: 'CHECKPOINT_SAVED', label: 'Checkpoint ckpt_0004', detail: '5 files · content-hash 校验通过', timestamp: '14:11:03' },
      { sequence: 4, type: 'TOOL_CALL', label: 'edit_file core/agent/harness/CheckpointStore.kt', detail: '+62 −9', timestamp: '14:18:40' },
      { sequence: 5, type: 'TEST_RUN', label: 'gradle :core:agent:test', detail: '34 passed · 1 failed · 2 skipped', timestamp: '14:24:07', tone: 'warn' },
      { sequence: 6, type: 'FIX_APPLIED', label: '修复失败用例 restoreAfterInterruptedRun', detail: 'iteration 6', timestamp: '14:25:31' },
      { sequence: 7, type: 'TEST_RUN', label: '重新运行核心测试', detail: '运行中 41/60 工具调用', timestamp: '14:25:52', tone: 'neutral' },
    ],
  },
  {
    id: 'T-2479',
    projectId: 'p_nexus_core',
    title: '补齐 Reno12 设备画像 ABI 与 RAM 字段采集',
    status: 'WAITING_APPROVAL',
    stage: 'WAITING_APPROVAL',
    target: 'PAD_LOCAL',
    agentRole: 'Developer',
    branch: 'agent/device-profile',
    checkpoint: 'ckpt_0002',
    createdAt: '今天 13:31',
    updatedAt: '2 分钟前',
    budget: { tokensUsed: 96_200, tokensMax: 180_000, costUsd: 0.21, costMaxUsd: 0.6, minutes: 12, minutesMax: 25, tools: 18, toolsMax: 40 },
    progress: 46,
    testSummary: null,
    diffSummary: { files: 2, additions: 74, deletions: 12 },
    awaitingApprovalId: 'apr_0912',
    risk: 'medium',
    events: [
      { sequence: 1, type: 'TASK_CREATED', label: '任务已创建', detail: 'target=PAD_LOCAL', timestamp: '13:31:02' },
      { sequence: 2, type: 'RUNNING', label: '读取 DeviceProfileCollector.kt', timestamp: '13:31:18' },
      { sequence: 3, type: 'APPROVAL_REQUESTED', label: '请求设备本地读取 Build 属性', detail: 'capability=Device:Request · risk=medium', timestamp: '13:43:19', tone: 'warn' },
    ],
  },
  {
    id: 'T-2476',
    projectId: 'p_nexus_core',
    title: '修复 PTY 会话退出后 fd 泄漏',
    status: 'REVIEWING',
    stage: 'REVIEWING',
    target: 'REMOTE_SSH',
    agentRole: 'Reviewer',
    branch: 'agent/pty-leak',
    checkpoint: 'ckpt_0011',
    createdAt: '今天 11:04',
    updatedAt: '9 分钟前',
    budget: { tokensUsed: 152_300, tokensMax: 200_000, costUsd: 0.44, costMaxUsd: 0.6, minutes: 31, minutesMax: 45, tools: 52, toolsMax: 70 },
    progress: 92,
    testSummary: { passed: 48, failed: 0, skipped: 1 },
    diffSummary: { files: 3, additions: 61, deletions: 8 },
    events: [
      { sequence: 1, type: 'TASK_CREATED', label: '任务已创建', detail: 'target=REMOTE_SSH · edge-01', timestamp: '11:04:40' },
      { sequence: 2, type: 'REPRODUCED', label: '复现：连续 open/close 200 次泄漏 3 个 fd', timestamp: '11:16:22' },
      { sequence: 3, type: 'TEST_RUN', label: 'PtySessionTest 通过', detail: '48 passed · 0 failed', timestamp: '11:41:08', tone: 'ok' },
      { sequence: 4, type: 'REVIEW_READY', label: 'Reviewer 提交审查结论', detail: '2 处建议：close 幂等 + registry 注销顺序', timestamp: '11:52:17', tone: 'accent' },
    ],
  },
  {
    id: 'T-2470',
    projectId: 'p_orbit',
    title: 'SSH 主机密钥变更时阻止自动连接',
    status: 'COMPLETED',
    stage: 'COMPLETED',
    target: 'PHONE_LOCAL',
    agentRole: 'Integrator',
    branch: 'agent/ssh-hostkey',
    checkpoint: 'ckpt_0009',
    createdAt: '昨天 20:12',
    updatedAt: '昨天 22:41',
    budget: { tokensUsed: 88_400, tokensMax: 120_000, costUsd: 0.19, costMaxUsd: 0.4, minutes: 26, minutesMax: 30, tools: 33, toolsMax: 40 },
    progress: 100,
    testSummary: { passed: 22, failed: 0, skipped: 0 },
    diffSummary: { files: 4, additions: 121, deletions: 18 },
    events: [
      { sequence: 1, type: 'TASK_CREATED', label: '任务已创建', timestamp: '20:12:03' },
      { sequence: 2, type: 'COMPLETED', label: '已合并到 main', detail: 'commit 8f1c2ab · 证据包已归档', timestamp: '22:41:55', tone: 'ok' },
    ],
  },
  {
    id: 'T-2468',
    projectId: 'p_nexus_core',
    title: 'Gradle 多模块骨架接入 Compose 编译器',
    status: 'FAILED',
    stage: 'FAILED',
    target: 'CLOUD_SANDBOX',
    agentRole: 'Developer',
    branch: 'agent/compose-skeleton',
    checkpoint: 'ckpt_0003',
    createdAt: '昨天 17:20',
    updatedAt: '昨天 18:03',
    budget: { tokensUsed: 44_100, tokensMax: 150_000, costUsd: 0.11, costMaxUsd: 0.5, minutes: 43, minutesMax: 40, tools: 29, toolsMax: 60 },
    progress: 34,
    testSummary: { passed: 0, failed: 3, skipped: 0 },
    diffSummary: null,
    events: [
      { sequence: 1, type: 'TASK_CREATED', label: '任务已创建', timestamp: '17:20:11' },
      { sequence: 2, type: 'STOPPED', label: '超过时间预算停止', detail: '依赖解析超时 3 次：compose.compiler 版本不匹配', timestamp: '18:03:47', tone: 'danger' },
    ],
  },
]

export const approvals: Approval[] = [
  {
    id: 'apr_0912',
    taskId: 'T-2479',
    deviceId: 'dev_pad',
    capability: 'Device:Request',
    operation: '读取 Pad 本地 Build 属性与 /proc/meminfo，用于补齐设备画像字段',
    risk: 'medium',
    status: 'PENDING',
    expiresInSec: 300,
    requestedBy: 'Agent · Developer',
  },
]

export const diffFiles: DiffFile[] = [
  {
    path: 'core/terminal/PtySession.kt',
    lang: 'kotlin',
    additions: 18,
    deletions: 6,
    hunks: [
      {
        header: '@@ -12,9 +12,17 @@ class PtySession',
        lines: [
          { kind: 'ctx', text: '    private val registry: TerminalRegistry,' },
          { kind: 'ctx', text: ') : Closeable {' },
          { kind: 'add', text: '    private val closed = AtomicBoolean(false)' },
          { kind: 'add', text: '' },
          { kind: 'del', text: '    override fun close() {' },
          { kind: 'del', text: '        pty.close()' },
          { kind: 'del', text: '        registry.remove(id)' },
          { kind: 'add', text: '    override fun close() {' },
          { kind: 'add', text: '        // 幂等：重复 close 不得重复注销 registry' },
          { kind: 'add', text: '        if (!closed.compareAndSet(false, true)) return' },
          { kind: 'add', text: '        pty.close()' },
          { kind: 'add', text: '        registry.remove(id)' },
          { kind: 'add', text: '        events.publish(TerminalEvent.SessionExited(id))' },
          { kind: 'ctx', text: '    }' },
        ],
      },
    ],
  },
  {
    path: 'core/terminal/TerminalRegistry.kt',
    lang: 'kotlin',
    additions: 9,
    deletions: 2,
    hunks: [
      {
        header: '@@ -31,7 +31,14 @@ class TerminalRegistry',
        lines: [
          { kind: 'ctx', text: '    fun remove(id: SessionId) {' },
          { kind: 'del', text: '        sessions.remove(id)' },
          { kind: 'add', text: '        val removed = sessions.remove(id) ?: return' },
          { kind: 'add', text: '        removed.close()' },
          { kind: 'add', text: '        metrics.decrement("pty.open")' },
          { kind: 'ctx', text: '    }' },
        ],
      },
    ],
  },
  {
    path: 'core/terminal/PtySessionTest.kt',
    lang: 'kotlin',
    additions: 34,
    deletions: 0,
    hunks: [
      {
        header: '@@ -0,0 +1,34 @@',
        lines: [
          { kind: 'add', text: 'class PtySessionTest {' },
          { kind: 'add', text: '    @Test fun closeIsIdempotent() { /* 200x open/close，fd 增量为 0 */ }' },
          { kind: 'add', text: '    @Test fun exitEmitsSingleEvent() { /* 事件序列无重复 */ }' },
          { kind: 'add', text: '}' },
        ],
      },
    ],
  },
]

export const auditLog = [
  { at: '14:25:52', actor: 'agent:developer', action: 'EXECUTE gradle :core:agent:test', decision: 'ALLOW', reason: 'sandbox scope=build' },
  { at: '14:25:31', actor: 'agent:developer', action: 'WRITE core/agent/harness/CheckpointStore.kt', decision: 'ALLOW', reason: 'workspace scope=project' },
  { at: '13:43:19', actor: 'agent:developer', action: 'DEVICE:REQUEST read build.prop', decision: 'REQUIRE_APPROVAL', reason: 'capability=Device:Request, risk=medium' },
  { at: '13:41:02', actor: 'agent:developer', action: 'NETWORK https://dl.google.com', decision: 'ALLOW', reason: 'allowlist=gradle' },
  { at: '13:39:44', actor: 'root-helper', action: 'PRIVILEGED mount', decision: 'DENY', reason: 'policy: root 操作需显式审批' },
]

export const ledger: Array<{
  name: string
  status: CapabilityStatus
  scopes: string
  evidence: string
  note?: string
}> = [
  { name: 'SSH Host Key 校验', status: 'Verified', scopes: 'Reno12 · Pad · edge-01', evidence: '真机日志 + 拒绝连接测试', note: '密钥变更即阻断' },
  { name: 'Git Clone/Pull/Commit/Push', status: 'Verified', scopes: '双设备', evidence: '30 次操作回归' },
  { name: '云端 Sandbox 断线续跑', status: 'Verified', scopes: 'Cloud', evidence: '离线 12 分钟 · 事件无丢失' },
  { name: '设备同步 Snapshot 冲突检测', status: 'Implemented', scopes: '双设备', evidence: '单测 12 例，未做双机实测' },
  { name: 'PTY 交互', status: 'Implementing', scopes: 'Reno12 · Pad', evidence: '待真机交互回归' },
  { name: 'Root Provider 检测', status: 'Implementing', scopes: '双设备独立适配', evidence: 'Provider 尚未确认' },
  { name: 'ARM64 Native 执行', status: 'Planned', scopes: '双设备', evidence: '待 P0 采集', note: '不得按型号推断' },
  { name: 'Termux Userland', status: 'Planned', scopes: 'Pad 主力 / Phone 轻量', evidence: '待验证' },
  { name: 'proot-distro', status: 'Planned', scopes: 'Pad', evidence: '重点验证项' },
  { name: '多 Agent 并行', status: 'Planned', scopes: 'Cloud', evidence: '不进入 P0' },
  { name: 'ColorOS 流体云实时活动', status: 'Blocked', scopes: 'Reno12', evidence: '无公开 API，需 feature-detect 回退' },
  { name: '本地 Docker', status: 'Not Supported', scopes: '双设备', evidence: '明确不作为 v1 前置条件' },
]

export const terminalMeta = { sessionId: 'pty_04', shell: 'sh', runtime: 'native(bionic)' }

export const initialTerminal: Array<{ kind: 'cmd' | 'out' | 'ok' | 'warn' | 'err' | 'sys'; text: string }> = [
  { kind: 'cmd', text: './gradlew :core:agent:test --tests "*CheckpointStore*"' },
  { kind: 'out', text: '> Task :core:agent:compileDebugKotlin' },
  { kind: 'out', text: '> Task :core:agent:test' },
  { kind: 'ok', text: 'CheckpointStoreTest > restoreAfterInterruptedRun() PASSED' },
  { kind: 'ok', text: 'CheckpointStoreTest > replayIsIdempotent() PASSED' },
  { kind: 'warn', text: 'CheckpointStoreTest > concurrentSaveKeepsLatest() FAILED (修复后重跑中)' },
  { kind: 'out', text: '' },
  { kind: 'out', text: 'BUILD: 34 passed · 1 failed · 2 skipped · 41s' },
  { kind: 'cmd', text: 'git status --short' },
  { kind: 'out', text: ' M core/agent/harness/AgentLoop.kt' },
  { kind: 'out', text: ' M core/agent/tools/ToolRegistry.kt' },
  { kind: 'out', text: ' M core/terminal/PtySession.kt' },
  { kind: 'out', text: ' A core/terminal/PtySessionTest.kt' },
]
