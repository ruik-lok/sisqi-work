# DSH HUD（悬浮操作指示器）

独立小应用：给 DSH 操作手机时提供实时可视化。

- 顶部胶囊：显示「DSH 操作中 · 点击 (540,1200)」「滑动 …」
- 点击处：涟漪 + 白色十字准心（650ms 消散）
- 滑动：蓝色轨迹（800ms 消散）
- 结束：胶囊变绿「完成」+ 系统通知

## 接口（本机回环，无需网络权限）

    GET http://127.0.0.1:8765/act?type=status&text=正在打开设置
    GET http://127.0.0.1:8765/act?type=tap&x=540&y=1200
    GET http://127.0.0.1:8765/act?type=swipe&x1=200&y1=900&x2=800&y2=900
    GET http://127.0.0.1:8765/act?type=done&text=任务完成 · 用时 12s
    GET http://127.0.0.1:8765/act?type=hide

## 构建

    ANDROID_JAR=/path/android.jar bash build.sh

安装后需要「显示在其他应用上层」权限（root 可用 appops 直接授予）：
    appops set com.sisqi.hud SYSTEM_ALERT_WINDOW allow
    am start-foreground-service -n com.sisqi.hud/.HudService
