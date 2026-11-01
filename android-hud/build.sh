#!/usr/bin/env bash
# 构建 DSH HUD：aapt2 + javac + d8 + zipalign + apksigner
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
if [ -x "$PREFIX/bin/aapt2" ]; then
  export PATH="$PREFIX/bin:$PATH"
  export LD_LIBRARY_PATH="$PREFIX/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
: "${ANDROID_JAR:?需要 ANDROID_JAR}"

B="$ROOT/build"
KS="$ROOT/.keystore/hud.jks"
rm -rf "$B"
mkdir -p "$B/gen" "$B/classes" "$B/dex" "$ROOT/.keystore" "$ROOT/assets"

aapt2 compile --dir "$ROOT/res" -o "$B/compiled.zip"
aapt2 link -o "$B/base.apk" -I "$ANDROID_JAR" \
  --manifest "$ROOT/AndroidManifest.xml" -A "$ROOT/assets" \
  --java "$B/gen" "$B/compiled.zip" \
  --min-sdk-version 24 --target-sdk-version 34

javac -nowarn -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$B/classes" \
  "$B/gen/com/sisqi/hud/R.java" "$ROOT"/src/com/sisqi/hud/*.java
d8 --lib "$ANDROID_JAR" --min-api 24 --output "$B/dex" "$B"/classes/com/sisqi/hud/*.class

cp "$B/base.apk" "$B/withdex.apk"
(cd "$B/dex" && zip -q "$B/withdex.apk" classes.dex)
zipalign -f 4 "$B/withdex.apk" "$B/aligned.apk"
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -alias hudkey \
    -storepass android -keypass android -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=DSH HUD,O=DSH,C=CN" >/dev/null 2>&1
fi
apksigner sign --ks "$KS" --ks-pass pass:android --key-pass pass:android \
  --out "$B/hud.apk" "$B/aligned.apk"
apksigner verify "$B/hud.apk" && echo "SIGN_OK"
ls -lh "$B/hud.apk"
