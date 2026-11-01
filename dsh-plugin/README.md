# dsh-tool-hud

DSH 插件：把「正在做什么」推到手机状态栏的流体云（配合 DSH HUD 小应用）。

## 工具

| 工具 | 作用 |
|---|---|
| hud_status | 显示当前动作（人话，例如「正在打开设置」） |
| hud_done | 切成完成态，30 秒后自动收起 |
| hud_hide | 立即收起 |

## 安装

1. 把 dsh-tool-hud/ 放到 DSH 能解析的位置：

       /data/user/0/com.deepseek.harness/files/payload/dshroot/lib/node_modules/@deepseek-ai/dsh/node_modules/@sisqi/dsh-tool-hud

2. 在 $DSH_HOME/cordis.patch.yml 里加：

       - id: tool-hud
         name: '@sisqi/dsh-tool-hud'

3. 重启 DSH 引擎。
4. DSH HUD 应用要在运行（监听 127.0.0.1:8765）。

端口可用环境变量 HUD_PORT 覆盖。
