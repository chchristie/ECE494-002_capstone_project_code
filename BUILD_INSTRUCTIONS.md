# Build Instructions - Heart Rate Monitor

Complete step-by-step guide to building the Heart Rate Monitor APK from source.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Installing Dependencies](#installing-dependencies)
4. [Building the APK](#building-the-apk)
5. [Troubleshooting](#troubleshooting)
6. [Build Optimization](#build-optimization)

---

## Prerequisites

### Required Software

| Software | Version | Download Link |
|----------|---------|---------------|
| Node.js | 16.x or higher | https://nodejs.org/ |
| npm | 8.x or higher | Included with Node.js |
| Java Development Kit (JDK) | 11 or 17 | https://adoptium.net/ |
| Android SDK | API Level 33+ | Via Android Studio |
| Android Studio | Latest | https://developer.android.com/studio |

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.14+, or Linux
- **RAM**: 8 GB minimum (16 GB recommended)
- **Storage**: 10 GB free space
- **Internet**: Required for downloading dependencies

---

## Environment Setup

### 1. Install Node.js

```bash
# Verify installation
node --version  # Should show v16.x or higher
npm --version   # Should show 8.x or higher
```

### 2. Install Java Development Kit (JDK)

**Windows:**
1. Download JDK 17 from https://adoptium.net/
2. Run installer and follow prompts
3. Add to PATH:
   - Right-click "This PC" → Properties → Advanced system settings
   - Environment Variables → System variables
   - Edit `PATH`, add: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x\bin`
4. Create `JAVA_HOME`:
   - New system variable: `JAVA_HOME` = `C:\Program Files\Eclipse Adoptium\jdk-17.x.x`

**macOS:**
```bash
brew install openjdk@17
```

**Verify:**
```bash
java -version  # Should show version 17.x
javac -version # Should show version 17.x
```

### 3. Install Android Studio

1. Download from https://developer.android.com/studio
2. Run installer, select:
   - Android SDK
   - Android SDK Platform
   - Android Virtual Device (optional)

### 4. Configure Android SDK

**Via Android Studio:**
1. Open Android Studio
2. Tools → SDK Manager
3. Install:
   - Android SDK Platform 33 (or latest)
   - Android SDK Build-Tools 33.x.x
   - Android SDK Command-line Tools
   - Android Emulator (optional)

**Set Environment Variables:**

**Windows:**
```powershell
# Add to System Environment Variables
ANDROID_HOME=C:\Users\<YourUsername>\AppData\Local\Android\Sdk

# Add to PATH
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\tools
%ANDROID_HOME%\tools\bin
```

**macOS/Linux:**
```bash
# Add to ~/.bashrc or ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

**Verify:**
```bash
adb --version  # Should show Android Debug Bridge version
```

---

## Installing Dependencies

### 1. Navigate to Project Directory

```bash
cd C:\Users\julia\Documents\HeartRateMonitor_Shareable
# or on macOS/Linux: cd ~/HeartRateMonitor_Shareable
```

### 2. Install npm Dependencies

```bash
npm install
```

**Expected Output:**
```
added XXX packages in XXs
```

**Common Issues:**
- If `npm install` fails with EACCES error, try: `npm install --legacy-peer-deps`
- If node-gyp errors occur on Windows, install: `npm install -g windows-build-tools`

### 3. Verify Dependencies

```bash
npm list --depth=0
```

**Key Dependencies to Verify:**
- `react-native@0.73.2`
- `react-native-ble-manager`
- `react-native-sqlite-storage`
- `react-native-svg`

---

## Building the APK

### Method 1: Quick Build (Recommended)

**Windows:**
```batch
npm run build:android
```

If `npm run build:android` is not defined, create it in `package.json`:
```json
"scripts": {
  "build:android": "cd android && .\\gradlew.bat assembleDebug"
}
```

### Method 2: Manual Build (Step-by-Step)

This method gives you full control and is useful for debugging build issues.

#### Step 1: Bundle JavaScript

```bash
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res/
```

**What this does:**
- Compiles all JavaScript/TypeScript code
- Bundles into single `index.android.bundle` file
- Copies assets to Android resources

**Expected Output:**
```
info Writing bundle output to:, android/app/src/main/assets/index.android.bundle
info Done writing bundle output
```

**Critical:** If this step is skipped, APK will use cached JavaScript and won't reflect code changes!

#### Step 2: Build APK with Gradle

**Windows:**
```batch
cd android
.\gradlew.bat assembleDebug
```

**macOS/Linux:**
```bash
cd android
./gradlew assembleDebug
```

**Build Process:**
1. Downloads Gradle wrapper (first time only)
2. Compiles Java/Kotlin native modules
3. Merges resources
4. Packages APK with JavaScript bundle
5. Signs with debug keystore

**Expected Duration:**
- First build: 3-10 minutes (downloads dependencies)
- Subsequent builds: 30 seconds - 2 minutes

**Build Output:**
```
BUILD SUCCESSFUL in 1m 23s
```

#### Step 3: Locate APK

**Path:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

**Verify APK:**
```bash
# Windows PowerShell
Get-Item android\app\build\outputs\apk\debug\app-debug.apk | Select-Object Name, LastWriteTime, Length

# macOS/Linux
ls -lh android/app/build/outputs/apk/debug/app-debug.apk
```

**Expected Size:** 40-80 MB

---

## Installing APK on Device

### Option 1: USB Connection (Recommended)

1. Enable Developer Options on Android device:
   - Settings → About phone → Tap "Build number" 7 times
   - Go back → Developer options → Enable "USB debugging"

2. Connect device via USB

3. Install APK:
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**If app already installed:**
```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Option 2: Manual Transfer

1. Copy `app-debug.apk` to device (email, USB, cloud)
2. On device, tap APK file to install
3. Enable "Install from unknown sources" if prompted

---

## Troubleshooting

### Build Errors

#### Error: `'gradlew.bat' is not recognized`

**Solution:**
```batch
# Use .\ prefix on Windows
cd android
.\gradlew.bat assembleDebug
```

#### Error: `JAVA_HOME is not set`

**Solution:**
```bash
# Windows (in Command Prompt as Admin)
setx JAVA_HOME "C:\Program Files\Eclipse Adoptium\jdk-17.x.x"

# macOS/Linux
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

#### Error: `Unable to resolve module react-native-svg`

**Solution:**
```bash
npm install react-native-svg
cd android
.\gradlew.bat clean
cd ..
npm run build:android
```

#### Error: `Task :app:mergeDebugResources FAILED`

**Cause:** Duplicate resource files or corrupted cache

**Solution:**
```bash
cd android
.\gradlew.bat clean
cd ..
# Delete node_modules and reinstall
rm -rf node_modules
npm install
npm run build:android
```

#### Error: `Execution failed for task ':app:processDebugManifest'`

**Cause:** AndroidManifest.xml syntax error or missing permissions

**Solution:**
- Verify `android/app/src/main/AndroidManifest.xml` is valid XML
- Check all required permissions are declared

#### Error: `OutOfMemoryError: Java heap space`

**Solution:** Increase Gradle heap size in `android/gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=512m
```

### APK Installation Errors

#### Error: `App not installed`

**Common Causes:**
1. Conflicting signature (old version installed)
   - **Solution:** Uninstall old version first
2. Insufficient storage
   - **Solution:** Free up 100+ MB on device
3. Corrupted APK
   - **Solution:** Rebuild APK with `.\gradlew.bat clean assembleDebug`

#### Error: `Parse error: There is a problem parsing the package`

**Cause:** APK corrupted during transfer

**Solution:**
- Use `adb install` instead of manual transfer
- Verify APK integrity: check file size matches build output

---

## Build Optimization

### Speed Up Builds

1. **Enable Gradle Daemon** (`android/gradle.properties`):
```properties
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
```

2. **Use Gradle Build Cache**:
```properties
org.gradle.caching=true
android.enableBuildCache=true
```

3. **Incremental Builds**:
- Don't run `clean` unless necessary
- Only bundle JavaScript when code changes

### Reduce APK Size

1. **Enable ProGuard/R8** (for release builds):
```gradle
// android/app/build.gradle
buildTypes {
    release {
        minifyEnabled true
        shrinkResources true
    }
}
```

2. **Use APK Splits**:
```gradle
splits {
    abi {
        enable true
        reset()
        include "armeabi-v7a", "arm64-v8a"
    }
}
```

---

## Build Variants

### Debug Build (Current)

- **Command:** `.\gradlew.bat assembleDebug`
- **Signing:** Debug keystore (auto-generated)
- **Optimizations:** None
- **Use Case:** Development and testing

### Release Build (Production)

**Requirements:**
- Release keystore (create with `keytool`)
- Signing credentials in `android/gradle.properties` or keystore file

**Command:**
```bash
cd android
.\gradlew.bat assembleRelease
```

**Output:**
```
android/app/build/outputs/apk/release/app-release.apk
```

**Creating Release Keystore:**
```bash
keytool -genkeypair -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

---

## Verification Checklist

After building, verify:

- [ ] APK file exists at `android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] APK size is 40-80 MB
- [ ] Build timestamp is recent (within last hour)
- [ ] No errors in build log
- [ ] App installs on device without errors
- [ ] App opens without crashing
- [ ] All tabs load (Heart Rate, Motion, Trends, Bluetooth)

---

## Additional Resources

- **React Native Docs:** https://reactnative.dev/docs/getting-started
- **Android Developer Guide:** https://developer.android.com/guide
- **Gradle Build Tool:** https://docs.gradle.org/current/userguide/userguide.html
- **Project CODE_MAP.md:** Detailed codebase architecture
- **Project README.md:** Quick start and usage guide

---

## Quick Reference

### Most Common Build Commands

```bash
# Full clean rebuild
cd android && .\gradlew.bat clean && cd .. && npm run build:android

# Just rebuild APK (after code changes)
cd android && .\gradlew.bat assembleDebug

# Bundle JavaScript only
npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle

# Install on connected device
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# View build logs
cd android && .\gradlew.bat assembleDebug --info
```

### Build Time Estimates

| Task | First Time | Subsequent |
|------|------------|------------|
| npm install | 2-5 minutes | 30 seconds |
| JavaScript bundle | 30-60 seconds | 30 seconds |
| Gradle build | 5-10 minutes | 1-2 minutes |
| **Total** | **8-15 minutes** | **2-3 minutes** |

---

**Last Updated:** November 2025
**Tested On:** Windows 11, Android SDK 33, React Native 0.73.2
