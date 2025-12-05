# Building a Standalone APK (No Server Needed)

This guide shows you how to create an APK file that runs completely independently - no Metro bundler, no computer connection required.

## 🚀 Quick Steps

### 1. Build the APK

```bash
cd android
./gradlew assembleRelease
cd ..
```

Or use the npm script:
```bash
npm run android:assemble
```

### 2. Find Your APK

The standalone APK is here:
```
android/app/build/outputs/apk/release/app-release.apk
```

### 3. Install on Your Phone

**Method 1: USB (Easiest)**
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

**Method 2: Manual Transfer**
1. Copy `app-release.apk` to your phone (via USB, email, cloud storage)
2. On your phone:
   - Go to Settings → Apps → Special app access → Install unknown apps
   - Enable "Install unknown apps" for your file manager or email app
3. Open the APK file on your phone and tap "Install"

## ✅ What You Get

- **Standalone app** - Works without Metro server
- **All code bundled** - JavaScript is inside the APK
- **Production optimized** - Smaller, faster, no debug logs
- **Install anywhere** - Share with others, install on multiple devices

## 🔍 Verify It's Standalone

1. **Close Metro bundler** (Ctrl+C if running)
2. **Uninstall the debug version** from your phone
3. **Install the release APK**
4. **Disconnect USB** or turn off WiFi
5. **Open the app** - it should work perfectly!

## 📱 File Size

The standalone APK is typically **20-40 MB** (includes all assets and bundled JavaScript).

## ⚠️ Important Notes

- **Signing**: Currently uses debug keystore (fine for personal use)
- **Updates**: To update, rebuild and reinstall
- **First Build**: May take 2-5 minutes (downloads dependencies)
- **Subsequent Builds**: Usually 30-60 seconds

## 🛠️ Troubleshooting

**"Command not found: gradlew"**
```bash
cd android
chmod +x gradlew
cd ..
```

**"Build failed"**
```bash
cd android
./gradlew clean
cd ..
npm run android:assemble
```

**"Device not found" (for USB install)**
- Enable USB debugging on your phone
- Run `adb devices` to verify connection
- Or just transfer the APK file manually

## 🎯 That's It!

Your standalone APK is ready to use. No server needed - the app runs completely independently! 🎉

