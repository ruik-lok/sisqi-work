# DSH HUD（流体云版）

只做一件事：把 DSH 的操作状态显示在状态栏的**流体云**里（Android 16 实时更新通知，ColorOS 渲染）。

**没有悬浮窗**：不画任何覆盖在屏幕上的东西。

## 接口（本机回环 127.0.0.1:8765）

    GET /act?type=status&text=正在打开设置
    GET /act?type=tap&text=点击「WLAN」
    GET /act?type=swipe&text=滑动列表
    GET /act?type=done&text=完成 · 已打开 WLAN
    GET /act?type=hide

- 文字是给人看的（不要传坐标）
- 合并推送：最多 ~900ms 一次
- 心跳：有活动时每 20s 续期，30s 无事件自动收起

## 构建安装

    ANDROID_JAR=/path/android.jar bash build.sh
    pm install -r -t build/hud.apk
    appops set com.sisqi.hud POST_PROMOTED_NOTIFICATIONS allow
    am start-foreground-service -n com.sisqi.hud/.HudService

## 图标

鲸鱼取自已安装的 DSH（com.deepseek.harness）的 `res/drawable/ic_launcher.xml` 矢量路径：
- 应用图标：浅底 #F7F8FC + 黑色鲸鱼 #0B0C0F
- 通知/流体云：透明底 + 白色鲸鱼（单色）
