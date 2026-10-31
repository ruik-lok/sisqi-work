# 思祁.Work 设计系统 v2.0

Premium Professional Workstation：Clean、Precise、Minimal、Refined、Technical、Consistent。  
**Solid Surface UI**：以背景色差、1px 边框、留白与字重建立层级；禁止毛玻璃、Backdrop Blur、大面积半透明叠层、模糊浮层与发光边框。

---

## 1. 主题

两套完整 Token，不做简单反色；System 只做选择，不派生第三套色值。

| Token | Arctic Blue（亮） | Midnight Blue（暗） |
|---|---|---|
| Background | `#F4F7FC` | `#0C1422` |
| Surface | `#FFFFFF` | `#121E30` |
| Surface Secondary | `#EAF0F8` | `#192940` |
| Elevated | `#FFFFFF` | `#20334D` |
| Border | `#DCE5F0` | `#263B57` |
| Text Primary | `#17263D` | `#F0F5FF` |
| Text Secondary | `#61738C` | `#9AABC4` |
| Text Muted | `#8290A3` | `#71839D` |
| Accent | `#1769D2` | `#72B3FF` |
| Accent Soft | `#E2EEFF` | `#1B3555` |

语义色（状态）在两套主题内分别定义，保证 4.5:1 对比：

| 语义 | 亮 | 暗 | 软底 |
|---|---|---|---|
| Success | `#1C7A4E` | `#5FC08E` | `#E3F3EA` / `#16301F` |
| Warning | `#94600A` | `#E0A44E` | `#FDF0DA` / `#33240F` |
| Danger | `#AD2A21` | `#FF7A70` | `#FBE7E5` / `#3A1A18` |
| Info | `#1769D2` | `#72B3FF` | `#E2EEFF` / `#1B3555` |

状态永远「颜色 + 文字」双通道；`待检测` 表示字段为 null，不是「暂不支持」。

---

## 2. 字体

| 用途 | 字族 | 字号 |
|---|---|---|
| 中文正文 | 楷体 `KaiTi`（回退 STKaiti / 楷体 / Noto Sans SC） | Body 14 / 15（对话） |
| 英文与数字 | Inter | 11 / 12 / 13 / 14 / 16 |
| 代码、终端、路径、ID、金额 | JetBrains Mono | 12–13，用户可调 |
| 标题 | Inter + 中文楷体混排 | H3 18 / H2 22 / H1 28 / Display 32 |
| 辅助标签 | 同上 | Label 12 / Caption 11 |

- 字重 400 / 500 / 600 / 700，不使用 300。
- 数字一律 `tabular-nums`；金额与 Token 不换行。
- 中文混排禁止全大写标签；英文标识（`CLOUD_SANDBOX`、分支）用等宽。
- 支持系统字体缩放；代码与终端字号独立可调，但默认值统一。

> 规范建议中文用 Noto Sans SC。当前交付按用户明确要求使用楷体，`--font-ui` 首项可一行切回。

---

## 3. 尺寸、表面与动效

- 间距以 4dp 为基准：4 / 8 / 12 / 16 / 20 / 24 / 32。
- 圆角：按钮 10–12、输入 10、卡片 16、弹层 22、手机外框 30。
- 页面、卡片、次级面板、弹窗一律不透明实体色；层级 = 底色差 + 1px 线 + 间距。
- 图标：Lucide 线性，1.5–2px 描边，行内 12–14px，导航 18–20px。
- 动效：微交互 150–180ms；组件 160–220ms；页面 200–280ms；面板 220–320ms。
- `prefers-reduced-motion: reduce` 时全部动画归零；禁止持续闪烁与过度弹跳。

---

## 4. 组件与状态

每个核心组件覆盖：默认、hover、focus-visible、disabled、loading、empty、error、success、permission required、offline/reconnecting。

| 组件 | 要点 |
|---|---|
| Button | 主操作 accent 实心；次操作描边；危险操作用 danger-soft；每屏一个主按钮 |
| IconButton | 32/36/44px；必须带 `aria-label` |
| TextField / SearchField | 1px 边框，focus 变 accent；错误文案在字段下方 |
| BottomNavigation | ≤ 5 项；活跃用 accent + 文字，不用纯色块 |
| NavigationRail / Sidebar | 平板使用；Lite 模式隐藏次级项 |
| WorkspaceCard / ProjectCard | 标题 + 元信息 + 状态；不使用多层嵌套卡片 |
| AgentTaskCard / AgentTimeline | 状态点 + 时间 + 事件类型；进度来自真实事件 |
| DeviceCard / RuntimeCard | 型号、API、ABI、Root Provider；未知显示「待检测」 |
| TerminalPanel / EditorTabs | 等宽；行号与代码同一行渲染 |
| DiffViewer | 逐文件接受/驳回；不静默覆盖 |
| ApprovalDialog | 能力、风险、有效期、凭据边界、单次授权 |
| StatusIndicator | 点 + 文字；运行中才脉冲 |
| Snackbar | 底部或右下；4 秒自动消失；不遮挡关键操作 |
| BottomSheet | 手机专用；安全区留白；Esc / 下滑关闭 |
| EmptyState | 图标 + 一句引导 + 一个主操作 |
| Loading / Error | 骨架或行内占位；错误给出可执行修复建议 |

---

### 会话状态

| 状态 | 表现 |
|---|---|
| 空会话 | 品牌标记 + 一句话 + 三个建议（点击直接发送） |
| 流式生成 | 光标脉冲 + 输入框变为「停止」；可随时中止 |
| 演示模式 | 输入框上方一条浅色提示 + 「配置模型」按钮；消息角标「演示」 |
| 请求失败 | 输入框上方错误条：标题（含 HTTP 状态）、可执行建议、原始摘要、「模型设置」入口 |
| 已生成 | 悬停出现复制 / 重新生成；不展示假进度 |
## 5. 长文本与溢出（v2.0.1 修订）

卡片、对话与时间线里的路径、哈希、URL 都是长 token，必须显式处理，否则会撑破布局：

- 正文与气泡：`overflow-wrap: anywhere`（工具类 `.wrap-any`），并给弹性子项加 `min-w-0`。
- 单行元信息：`truncate`（省略号），并在悬停时用 `title` 展示完整值。
- 代码 / 终端 / Diff：自身横向滚动（`overflow-x-auto`），不撑开父容器。
- 表格：外层 `overflow-x-auto`，不裁切列。
- 浮层：对话框 `max-h-[92%]` + 内容区滚动；命令面板 `max-h-[88%]` + 列表滚动；BottomSheet `max-h-[78%]`。
- 预览舞台：浮层挂载在设备外框内（OverlayRoot），不再铺满浏览器窗口；外框 `overflow-hidden` 负责裁切。
- 缩放计算：容器必须有确定宽度（`w-full`），否则会出现「内容宽度 → 缩放 → 宽度」的反馈环，把设备缩到最小比例。

自检：把窗口拖到 1100×720 与 560 高，逐页检查对话框、命令面板、BottomSheet、长字符串消息，不应出现横向滚动条或文字被裁切。
## 5. Insets 与沉浸式（原型模拟 vs 原生）

原型：手机壳顶部 26px、底部 16px 安全区，背景延伸；**不绘制假手势条**，不伪造状态栏图标。  
原生：见 `compose-mapping.md`，统一使用 `WindowInsets`（statusBars / navigationBars / displayCutout / ime / safeDrawing / safeGestures），不写死高度、不重复补偿。

---

## 6. Do / Don't

**Do**
- 先减元素，再调节奏，最后调色。
- 用 1px 线与底色差分层级；能留白就不画线。
- 危险操作二次确认，并在按钮旁写清后果。
- 会话是默认入口：打开就能提问、继续上次工作。

**Don't**
- 不用毛玻璃、半透明叠层、发光、渐变描边。
- 不用假进度、假成功率、假延迟冒充真实执行。
- 不在手机端堆叠项目树、终端与多面板。
- 不把 `Planned` 能力画成可用。

---

## 7. 交付前自检

- [ ] Arctic Blue / Midnight Blue / System 均验证；系统栏图标对比度正确。
- [ ] 全站无 `backdrop-blur` 与大面积半透明。
- [ ] 顶部内容避开状态栏、挖孔与圆角安全区；底部控件避让手势区。
- [ ] 键盘弹出时输入框可见；滚动到底不被固定条遮挡。
- [ ] 中文、英文、数字混排无溢出；路径与终端可横向滚动。
- [ ] 键盘可完成：导航、发送、停止生成、批准/拒绝、命令面板。
- [ ] 图标按钮有标签；状态不只靠颜色。
- [ ] 触控目标 ≥ 48dp（手机主操作 ≥ 44px）。
- [ ] `prefers-reduced-motion` 下无位移动画。
- [ ] 每屏至少亮/暗两张截图；截图不能替代交互测试。
