# 思祁.Work · Android 外壳

把 `sisqi-work` 的 Web 界面装进一个原生 WebView 壳里，得到可安装的 APK（演示/自用，不是应用商店版本）。

## 结构

| 文件 | 作用 |
| --- | --- |
| `src/com/sisqi/work/MainActivity.java` | WebView 壳：`shouldInterceptRequest` 直接读 assets（假域名 `https://appassets.local`，不需要本地 HTTP 服务/明文网络）；系统栏配色桥；返回键处理 |
| `src/com/sisqi/work/SecretStore.java` | Android Keystore AES-256-GCM 加密的凭据存储（`SharedPreferences` 里只有密文） |
| `res/drawable/ic_launcher.xml` | 启动图标（与 favicon 同源的矢量图） |
| `AndroidManifest.xml` | 包名 `com.sisqi.work`、minSdk 24 / targetSdk 34、`adjustResize` |

## 页面桥（`window.SisqiHost`）

| 方法 | 用途 |
| --- | --- |
| `setChrome('light' \| 'dark')` | 状态栏/导航栏颜色与图标明暗跟随页面主题 |
| `setSecret(id, value)` / `getSecret(id)` / `deleteSecret(id)` | 加密凭据读写；同步调用，JS 侧包成 Promise |
| `secretBackend()` | 返回 `android-keystore-aes-gcm`，供界面显示存储方式 |

Web 端在 `src/lib/secrets.ts` 里探测 `window.SisqiHost.getSecret`：有就用加密存储（并在第一次读取时把旧的 localStorage 密钥迁移过去），没有就退回浏览器 localStorage（Electron 版仍走 `window.sisqi.secrets`）。

## 构建

前置：Android SDK 的 `android.jar`（API 34），以及 `aapt2`、`javac`(JDK 8+)、`d8`、`zipalign`、`apksigner`、`zip`。

```bash
# 1. 先构建 Web（仓库根目录）
npm run build

# 2. 构建 APK（把 dist 打进 assets，输出到 android/build/sisqi.apk）
ANDROID_JAR=/path/to/android.jar DIST=../dist ./build.sh

# 3. 安装
adb install -r android/build/sisqi.apk
```

首次构建会生成 `build/debug.keystore`（仅自用签名，勿用于正式发布）。

## 注意

- 只允许加载自带 assets，页面里没有 `addJavascriptInterface` 之外的系统能力（不暴露 shell / 文件系统）。
- 换主题时状态栏立即跟随；ColorOS 上不要改成 edge-to-edge（会黑屏掉图标）。
- 重新打包后若浏览器端缓存了旧页面，先卸载或清应用数据。
