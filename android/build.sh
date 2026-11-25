#!/usr/bin/env bash
# Fabrique l'APK Android d'Aleph (lancé par GitHub Actions : .github/workflows/android.yml).
# L'appli charge onizard.github.io/aleph : les mises à jour du site arrivent sans réinstaller l'APK.
set -euo pipefail
cd "$(dirname "$0")"
npm install --no-audit --no-fund
rm -rf android
npx cap add android
P=android/app/src/main
cp native/*.java "$P/java/fr/onizard/aleph/"
# permissions : micro, réglages audio (bascule Bluetooth), Bluetooth
sed -i 's#<uses-permission android:name="android.permission.INTERNET" />#&\n    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />\n    <uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />\n    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />#' "$P/AndroidManifest.xml"
grep -q RECORD_AUDIO "$P/AndroidManifest.xml"
# Android 11+ : rendre visibles le service de reconnaissance vocale et la synthèse vocale
sed -i 's#</manifest>#    <queries>\n        <intent><action android:name="android.speech.RecognitionService" /></intent>\n        <intent><action android:name="android.intent.action.TTS_SERVICE" /></intent>\n    </queries>\n</manifest>#' "$P/AndroidManifest.xml"
# icône Aleph
rm -rf "$P/res/mipmap-anydpi-v26"
for d in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  convert ../icons/icon-512.png -resize "${d#*:}x${d#*:}" "$P/res/mipmap-${d%%:*}/ic_launcher.png"
  cp "$P/res/mipmap-${d%%:*}/ic_launcher.png" "$P/res/mipmap-${d%%:*}/ic_launcher_round.png"
  rm -f "$P/res/mipmap-${d%%:*}/ic_launcher_foreground.png"
done
npx cap sync android
# toujours la même signature : une nouvelle version s'installe par-dessus l'ancienne sans perdre la progression
mkdir -p ~/.android && cp aleph-debug.keystore ~/.android/debug.keystore
(cd android && chmod +x gradlew && ./gradlew --no-daemon assembleDebug)
cp android/app/build/outputs/apk/debug/app-debug.apk aleph.apk
