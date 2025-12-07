# Build Instructions

Guide to building the Heart Rate Monitor app APK.

## Prerequisites

- **Node.js**: 18+ (`node --version`)
- **JDK**: 17 (`java -version`)
- **Android Studio**: Android SDK Platform 33+
- **Environment**: Set `ANDROID_HOME` to your Android SDK path

### Quick Setup

**macOS/Linux:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Windows:**
```
ANDROID_HOME=C:\Users\<YourUsername>\AppData\Local\Android\Sdk
PATH=%PATH%;%ANDROID_HOME%\platform-tools
```

## Installation

```bash
npm install
```

## Build Types

### Debug Build (Development)

Build and install on connected device:
```bash
npm run android
```

Build APK only:
```bash
cd android
./gradlew assembleDebug    # macOS/Linux
.\gradlew.bat assembleDebug  # Windows
```

**Output:** `android/app/build/outputs/apk/debug/app-debug.apk`

### Standalone Build (No Metro Server)

Builds a standalone APK that works without Metro bundler:

```bash
npm run android:assemble
```

Or manually:
```bash
cd android
./gradlew assembleRelease
```

**Output:** `android/app/build/outputs/apk/release/app-release.apk`

**Note:** Uses debug keystore (fine for personal use). For production signing, create a release keystore.

## Install APK

**Via USB:**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

**Manual:** Copy APK to device and tap to install (enable "Install unknown apps" if prompted)

## Troubleshooting

**Build fails:**
```bash
cd android && ./gradlew clean && cd .. && npm install
```

**JAVA_HOME not set:**
```bash
# macOS
export JAVA_HOME=$(/usr/libexec/java_home -v 17)

# Windows
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17"
```

**Module resolution errors:**
```bash
rm -rf node_modules && npm install
cd android && ./gradlew clean
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm run android` | Build & install debug on device |
| `npm run android:assemble` | Build standalone APK |
| `cd android && ./gradlew clean` | Clean build cache |
| `adb devices` | List connected devices |

