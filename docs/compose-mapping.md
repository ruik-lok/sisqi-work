# Jetpack Compose 落地映射（v2.0）

目标：Android 端与 Web 原型在 Token、组件与语义上一致。原则：**语义 Token 双端同名同值**，业务组件不写死颜色与尺寸。

---

## 1. 颜色

```kotlin
@Immutable
data class WorkColors(
    val bg: Color, val surface: Color, val surface2: Color, val elevated: Color,
    val border: Color, val textPrimary: Color, val textSecondary: Color, val textMuted: Color,
    val accent: Color, val accentSoft: Color, val onAccent: Color,
    val success: Color, val successSoft: Color,
    val warning: Color, val warningSoft: Color,
    val danger: Color, val dangerSoft: Color,
)

val ArcticBlue = WorkColors(
    bg = Color(0xFFF4F7FC), surface = Color(0xFFFFFFFF), surface2 = Color(0xFFEAF0F8), elevated = Color(0xFFFFFFFF),
    border = Color(0xFFDCE5F0), textPrimary = Color(0xFF17263D), textSecondary = Color(0xFF61738C), textMuted = Color(0xFF8290A3),
    accent = Color(0xFF1769D2), accentSoft = Color(0xFFE2EEFF), onAccent = Color(0xFFFFFFFF),
    success = Color(0xFF1C7A4E), successSoft = Color(0xFFE3F3EA),
    warning = Color(0xFF94600A), warningSoft = Color(0xFFFDF0DA),
    danger = Color(0xFFAD2A21), dangerSoft = Color(0xFFFBE7E5),
)

val MidnightBlue = WorkColors(
    bg = Color(0xFF0C1422), surface = Color(0xFF121E30), surface2 = Color(0xFF192940), elevated = Color(0xFF20334D),
    border = Color(0xFF263B57), textPrimary = Color(0xFFF0F5FF), textSecondary = Color(0xFF9AABC4), textMuted = Color(0xFF71839D),
    accent = Color(0xFF72B3FF), accentSoft = Color(0xFF1B3555), onAccent = Color(0xFF06152A),
    success = Color(0xFF5FC08E), successSoft = Color(0xFF16301F),
    warning = Color(0xFFE0A44E), warningSoft = Color(0xFF33240F),
    danger = Color(0xFFFF7A70), dangerSoft = Color(0xFF3A1A18),
)

val LocalWorkColors = staticCompositionLocalOf { MidnightBlue }

@Composable
fun WorkTheme(mode: ThemeMode = ThemeMode.System, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.System -> isSystemInDarkTheme()
        ThemeMode.Dark -> true
        ThemeMode.Light -> false
    }
    val colors = if (dark) MidnightBlue else ArcticBlue
    CompositionLocalProvider(LocalWorkColors provides colors) {
        MaterialTheme(colorScheme = colors.toScheme(), typography = WorkTypography, content = content)
    }
}
```

禁用：`Modifier.blur`、半透明大图层、带光晕的 shadow；层级用 `border(1.dp, colors.border)` + 背景色差。

---

## 2. 字体

规范默认：Noto Sans SC（中文）+ Inter（英文与数字）+ JetBrains Mono（代码）。  
当前交付的中文用楷体；原生侧建议：

```kotlin
// 方案 A（规范默认）
val Sans = FontFamily(Font(R.font.noto_sans_sc_regular), Font(R.font.noto_sans_sc_medium), Font(R.font.inter_semibold))
// 方案 B（当前原型：中文楷体，需随包提供开源楷体，如 LXGW WenKai，SIL OFL）
val Kai = FontFamily(Font(R.font.lxgw_wenkai_regular), Font(R.font.lxgw_wenkai_medium))
val Sans = FontFamily(Kai, Font(R.font.inter_regular))   // 中文走楷体，英文/数字走 Inter
```

字号（sp）：Display 32 / H1 28 / H2 22 / H3 18 / BodyLarge 16 / Body 14 / BodySmall 13 / Label 12 / Caption 11。  
代码、终端默认 13sp，可独立调整；数字 `fontFeatureSettings = "tnum"`。

---

## 3. 尺寸

```kotlin
object WorkSpacing { val x1 = 4.dp; val x2 = 8.dp; val x3 = 12.dp; val x4 = 16.dp; val x5 = 20.dp; val x6 = 24.dp }
object WorkRadius { val button = 11.dp; val input = 10.dp; val card = 16.dp; val sheet = 22.dp }
object WorkSize {
    val hairline = 1.dp
    val rail = 228.dp
    val sessionList = 268.dp
    val contextPanel = 320.dp
    val minTouch = 48.dp
}
```

---

## 4. Edge-to-Edge 与 Insets（P0）

```kotlin
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(   // 背景延伸到系统栏后方
            statusBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT),
        )
        setContent { WorkTheme { WorkApp() } }
    }
}

@Composable
fun WorkApp() {
    val insets = WindowInsets.safeDrawing   // 已包含 statusBars / displayCutout / navigationBars
    val ime = WindowInsets.ime
    Scaffold(
        contentWindowInsets = WindowInsets(0, 0, 0, 0),  // 避免重复补偿
        bottomBar = { PhoneNavBar(Modifier.navigationBarsPadding().imePadding()) },
    ) { padding ->
        Box(Modifier.fillMaxSize()) {
            ChatScreen(Modifier.padding(padding).windowInsetsPadding(insets))
        }
    }
}
```

要求：
- 背景延伸到状态栏与导航区，**内容**避让 `safeDrawing`；不写死状态栏高度。
- 不绘制假 Gesture Handle；保留系统手势条。
- 只在容器上加一次 Insets padding，子组件不再重复。
- 弹窗、BottomSheet、全屏编辑器、搜索页使用同一套规则。
- 键盘弹出时输入框可见：`Modifier.imePadding()` + `bringIntoViewRequester`。
- 分别验证 Android 14 / API 34 与 Android 16 / API 36。

---

## 5. Lite / Pro 与自适应

```kotlin
@Composable
fun WorkApp() {
    val mode = rememberUiMode()          // Lite / Pro，持久化在 DataStore
    val width = currentWindowAdaptiveInfo().windowSizeClass.windowWidthSizeClass
    when {
        width == WindowWidthSizeClass.Compact || mode == UiMode.Lite -> LiteShell()
        else -> ProShell()
    }
}
```

- Lite：会话首页 + 底部 5 项导航；复杂能力通过二级页进入，不删减功能。
- Pro：侧边栏 + 会话三栏；项目页三栏 + 终端 Dock。
- 两模式共用同一 ViewModel / Repository / Room；切换不清空会话、任务、编辑器与终端状态。
- Reno12 默认 Lite，Pad Pro 默认 Pro，用户可覆盖。

---

## 6. 组件映射

| Web | Compose |
|---|---|
| Button / IconButton | `Surface(shape, color)` + `Text`；主按钮 `accent` 底、`onAccent` 字 |
| StatusPill | `Row { 6.dp 圆点; Text(textPrimary/secondary) }` |
| Panel | `Surface(shape = RoundedCornerShape(16.dp), color = surface, border = 1.dp border)` |
| Meter | 4.dp 圆角槽 + `progressBarRangeInfo` 语义 |
| Dialog / BottomSheet | 不透明 `elevated`；`usePlatformDefaultWidth = false`；焦点与返回键处理 |
| CommandPalette | `BasicTextField` + `LazyColumn`，`onKeyEvent` 处理 ↑↓/Enter |
| ChatThread | `LazyColumn` + `animateItemPlacement`；流式文本用同一个 `Text` 更新 |
| Composer | `BasicTextField` + `imePadding` + `bringIntoViewRequester` |
| AgentTimeline | `LazyColumn`，事件来自后端 sequence，不生成假进度 |
| TerminalPanel | 真实 PTY + `BasicTextField`，`SelectionContainer` 可复制 |
| DiffViewer | 逐文件 hunk，接受/驳回写回工作区，冲突显式提示 |
| ApprovalDialog | 能力、风险、过期时间、调用范围，单次授权 |

---

## 7. 状态与安全

```kotlin
enum class CapabilityStatus { Planned, Implementing, Implemented, Verified, Blocked, NotSupported }
enum class TaskStatus { Queued, Preparing, Running, WaitingApproval, Paused, Testing, Reviewing, Completed, Failed, Cancelled }
enum class TestVerdict { Pass, Fail, NotRun, Blocked }
```

- API Key 用 `EncryptedSharedPreferences` / Keystore 派生密钥；不进日志、不进崩溃报告、不进普通备份。
- Agent 只拿到凭据引用或代理能力，不读取完整密钥。
- Root 由独立 Helper 进程与窄 IPC 承担；云端默认无设备 Root。
- 外部内容（网页、README、终端输出）一律不可信，不能覆盖系统指令。

---

## 8. 落地顺序

1. `:core:designsystem`：WorkColors、字体、间距、核心组件 + 双主题 `@Preview`。
2. `:feature:chat`：会话列表、流式对话、Composer、上下文栏（先接 mock，再接 SSE）。
3. `:feature:models`：Provider、密钥（Keystore）、模型、连接测试、用量。
4. `:feature:projects` / `:feature:agent`：编辑器、终端、时间线、审批。
5. Insets 与 Lite/Pro 在 Reno12（API 36）与 Pad Pro（API 34）分别验收；未实测项保持 NOT RUN。
