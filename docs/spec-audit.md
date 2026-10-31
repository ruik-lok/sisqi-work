# v2.0 规范审计：原型对照表

对照 `思祁.Work_完整开发升级规范_v2.0.docx` 逐项审计**当前交付物**（Web 设计原型，非 Android 工程）。  
状态口径严格区分：

- **已实现**：原型中可点击、可验证
- **部分实现**：有界面与状态，但数据为演示数据或缺少真实链路
- **未实现**：原型未覆盖
- **不适用**：属于原生 Android / 云端工程，Web 原型无法承担

## 1. 品牌与视觉

| 规范项 | 状态 | 说明 |
|---|---|---|
| 品牌名 思祁.Work / SISQI.Work | 已实现 | 侧边栏、顶栏、关于页 |
| 标语「让想法，真正成为作品。」 | 已实现 | 顶栏、会话空状态 |
| Wordmark + 独立图形标记 | 已实现 | 开放方形 + 连续笔势，避开机器人/大脑/芯片/星星 |
| Solid Surface（禁毛玻璃/发光） | 已实现 | 全站无 backdrop-blur；面板不透明 + 1px 边框 |
| 双主题 Arctic Blue / Midnight Blue | 已实现 | 设计令牌逐项对齐文档色值 |
| Light / Dark / System | 已实现 | System 监听 `prefers-color-scheme` |

## 2. 设计系统

| 规范项 | 状态 | 说明 |
|---|---|---|
| 4dp 间距、卡片 14–18dp、按钮 10–12dp | 已实现 | 令牌 `--radius-md 11 / --radius-lg 16 / --radius-xl 22` |
| 字体体系（中文/英文/等宽/辅助） | 部分实现 | 中文楷体（用户指定）+ Inter + JetBrains Mono；Noto Sans SC 作为回退，可在 `--font-ui` 一行切换 |
| 组件库（Button…ErrorState 24 类） | 部分实现 | 已提供 Button、IconButton、TextField、SearchField、BottomNavigation、NavigationRail、Sidebar、WorkspaceCard、ProjectCard、AgentTaskCard、AgentTimeline、DeviceCard、TerminalPanel、EditorTabs、DiffViewer、ApprovalDialog、StatusIndicator、Snackbar、BottomSheet、EmptyState；RuntimeCard、Loading/Error 状态为简化版 |
| 动效 120–320ms + 减少动态 | 已实现 | 150–280ms；`prefers-reduced-motion` 归零 |

## 3. 信息架构与双 UI

| 规范项 | 状态 | 说明 |
|---|---|---|
| 一级导航：会话 / 项目 / Agent / 连接 / 设置 | 已实现 | Pad 侧边栏与手机底部导航一致 |
| 默认首页为 AI 会话工作台 | 已实现 | `?pad=chat`，手机默认会话 |
| 手机端独立布局（非平板压缩） | 已实现 | 单列会话、历史 BottomSheet、任务 BottomSheet |
| 平板三栏会话（历史 / 对话 / 上下文） | 已实现 | Pro 模式三栏，Lite 模式单栏 |
| Lite / Pro 共用业务与数据 | 已实现（原型层） | 同一 store 与路由；切换不重置会话、任务状态 |
| Reno12 默认 Lite、Pad 默认 Pro | 已实现 | 手机壳固定 Lite；Pad 默认 Pro，可切 Lite |
| 模式切换不中断任务 | 部分实现 | 原型内状态保留；无真实 Agent 进程 |

## 4. 会话能力

| 规范项 | 状态 | 说明 |
|---|---|---|
| 新建 / 搜索 / 恢复 / 收藏 / 归档 | 部分实现 | 新建、搜索、切换、置顶标记；归档/删除未做交互 |
| 流式回复 / 停止生成 | 已实现 | 演示流式（700ms 分片）+ 停止生成 |
| 模型选择 / 附件 / 工具模式 | 已实现 | 模型菜单、附件与执行模式入口（提示） |
| 会话关联项目 / 任务 | 已实现 | 会话头、上下文栏、任务详情联动 |
| 上下文快照与真实 Git 核对 | 未实现 | 属 Agent 基础设施 |

## 5. API Key 与模型管理

| 规范项 | 状态 | 说明 |
|---|---|---|
| 独立入口「模型与 API」 | 已实现 | 设置左侧独立分区 |
| Provider 可扩展（5 类 + 自定义） | 已实现 | 列表含 OpenAI / Anthropic / Gemini / DeepSeek / Compatible |
| Base URL、协议、认证、模型列表 | 部分实现 | 展示与编辑入口；无真实协议适配 |
| API Key 脱敏 / 更新 / 轮换 / 撤销 | 部分实现 | 脱敏展示 + 密钥入口；无真实 Keystore |
| 默认模型、上下文、价格、能力标签 | 已实现 | 模型表 + 能力来源标注 |
| 连接测试（延迟 / HTTP / 错误） | 部分实现 | 交互与状态机可用，延迟为模拟 |
| 用量统计（请求 / Token / 费用 / 成功率） | 部分实现 | 演示数据，明确标注「估算值，按 Provider 单价计算」 |

## 6. Android 系统栏与安全区域

| 规范项 | 状态 | 说明 |
|---|---|---|
| Edge-to-Edge、背景延伸 | 已实现（原型模拟） | 手机壳顶部/底部预留安全区，背景连续，无突兀色块 |
| 保留原生 Gesture Handle | 已实现（不绘假条） | 删除 v1 的模拟手势条 |
| 内容避让状态栏 / 手势区 | 已实现 | 手机壳 26px 顶部、16px 底部安全区 |
| Insets 统一管理、不重复补偿 | 不适用 | 由原生 `WindowInsets` 承担，见 Compose 映射 |

## 7. Agent、连接与运维

| 规范项 | 状态 | 说明 |
|---|---|---|
| Agent 时间线 / 审批 / 预算 / 权限 | 已实现（演示） | Agent 页与详情栏 |
| 任务暂停 / 恢复 / 取消 | 已实现 | 状态与事件更新 |
| Sandbox、Git 回滚、Evaluation | 未实现 | 需真实后端 |
| Connector / Skill / MCP | 部分实现 | 列表、权限范围、启停、状态 |
| Workflow、部署中心、通知中心 | 未实现 | 仅设置项占位说明 |

## 8. 测试与验收

原型提供的可执行验证：构建（`tsc` + `vite build`）、5 个交互冒烟场景（审批 / 会话流式 / 命令面板 / 主题 / 项目 Diff）。  
真机测试、系统栏 Insets 实测、Keystore、PTY、Root 审批、云端 Sandbox 均为 **NOT RUN**（无 Android 工程与真机接入），不得据此宣称通过。

## 8.5 v2.1 新增：由演示变为真实的能力

| 能力 | 状态 | 证据 |
|---|---|---|
| OpenAI 兼容流式对话（真实 HTTP/SSE） | 已实现 | 本地 mock LLM 端到端测试：回复流式到达、无错误横幅、usage=42/18 |
| Provider 增删改 + Base URL / 类型 / 调用方式 | 已实现 | 设置页表单，写入本机状态 |
| API Key 保存 / 更新 / 清除 + 掩码 | 已实现 | 桌面版 safeStorage 加密文件；实测 round-trip 正常、文件不含明文 |
| 连接测试（真实请求 `/models`） | 已实现 | 测试成功并拉取模型列表；失败有状态码与修复建议 |
| 模型增删改、启用、默认模型 | 已实现 | 模型表 + 对话框 |
| 会话与消息持久化 | 已实现 | 刷新后消息仍在（冒烟用例） |
| 会话重命名 / 置顶 / 删除 / 搜索 | 已实现 | 会话卡片菜单 |
| 用量统计（请求 / Token / 估算费用 / 延迟） | 已实现 | 由 Provider usage 字段累计 |
| 备份导出 / 导入（不含密钥） | 已实现 | JSON 文件下载与导入 |
| Anthropic / Gemini 原生协议 | 未实现 | 仅 OpenAI 兼容；界面已移除两家种子 Provider 以免误导 |
| 打开本机文件夹 / 文件树 | 已实现（桌面版） | 自动跳过 node_modules、.git、dist；目录越界读取被拒绝（实测 blocked） |
| 编辑并保存文件 | 已实现（桌面版） | 编辑 README 后 Ctrl+S 写入，重新读取内容一致 |
| 在工作区内执行命令 | 已实现（桌面版） | `echo` 与 `git status` 返回退出码与耗时；120s 超时、4MB 输出上限 |
| 浏览器内的文件读写 | 不支持 | 浏览器无文件系统权限；界面提示改用桌面版 |
## 9. 规范外新增：Windows 桌面壳

v2.0 规范面向 Android App，未包含桌面端。本次额外提供一个 Electron 壳（desktop/），仅用于在 Windows 上以原生窗口评审 Pro 三栏布局：

- 复用同一份 dist/ 构建，?mode=desktop 直接渲染 PadShell，无设备外框与预览栏。
- 窗口记忆、F11 全屏、外链走系统浏览器、无菜单栏；不访问本地文件/进程/凭据。
- 尚未打包安装器；如需分发再接 electron-builder。

## 10. 明确的偏差

1. **中文正文字体使用楷体**，而规范 §2.2 建议 Noto Sans SC。原因：用户上一轮明确要求「标准楷体」。已保留 Noto Sans SC 作为回退，改回只需修改 `src/styles/index.css` 的 `--font-ui`。
2. 原型中的能力状态、用量、延迟、测试结果均为**演示数据**，不代表真实账单或真机证据。
3. Web 原型无法验证 Android Insets、Keystore、PTY、Root 与 Sandbox；这些在 Compose 映射中给出实现要点，状态保持 NOT RUN。
