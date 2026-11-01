#!/usr/bin/env bash
# 构建 思祁.Work 的 Android 外壳：aapt2 + javac + d8 + zipalign + apksigner
# 依赖：aapt2 / d8 / zipalign / apksigner（Termux: aapt2, android-tools, openjdk-21, zip）
# 用法：DIST=../dist ANDROID_JAR=/path/android.jar ./build.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
if [ -x "$PREFIX/bin/aapt2" ]; then
  export PATH="$PREFIX/bin:$PATH"
  export LD_LIBRARY_PATH="$PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi

: "${ANDROID_JAR:?需要 ANDROID_JAR 指向 Android SDK 的 android.jar（API 34）}"

# 可选：把 web 构建产物拷进 assets（dist 由 ../ npm run build 生成）
if [ -n "${DIST:-}" ]; then
  [ -f "$DIST/index.html" ] || { echo "DIST 里没有 index.html：$DIST" >&2; exit 1; }
  rm -rf "$ROOT/assets/www"
  mkdir -p "$ROOT/assets"
  cp -R "$DIST" "$ROOT/assets/www"
fi
[ -f "$ROOT/assets/www/index.html" ] || { echo "缺少 assets/www/index.html：先构建 web，再用 DIST=... 指定 dist 目录" >&2; exit 1; }

B="$ROOT/build"
KS="$ROOT/.keystore/sisqi.jks"   # 签名文件不参与清理，保证增量安装签名一致
rm -rf "$B"
mkdir -p "$B/gen" "$B/classes" "$B/dex" "$ROOT/.keystore"

# 1) 资源
aapt2 compile --dir "$ROOT/res" -o "$B/compiled.zip"
aapt2 link -o "$B/base.apk" -I "$ANDROID_JAR" \
  --manifest "$ROOT/AndroidManifest.xml" -A "$ROOT/assets" \
  --java "$B/gen" "$B/compiled.zip" \
  --min-sdk-version 24 --target-sdk-version 34

# 2) 编译 + dex
javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$B/classes" \
  "$B/gen/com/sisqi/work/R.java" "$ROOT"/src/com/sisqi/work/*.java
d8 --lib "$ANDROID_JAR" --min-api 24 --output "$B/dex" "$B"/classes/com/sisqi/work/*.class

# 3) 打包 + 对齐 + 签名
cp "$B/base.apk" "$B/withdex.apk"
(cd "$B/dex" && zip -q "$B/withdex.apk" classes.dex)
zipalign -f 4 "$B/withdex.apk" "$B/aligned.apk"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias androiddebugkey \
    -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=Android Debug,O=Android,C=US" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$B/sisqi.apk" "$B/aligned.apk"
apksigner verify "$B/sisqi.apk" && echo "SIGN_OK"
ls -lh "$B/sisqi.apk"