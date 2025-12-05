# Release Build Instructions

This guide explains how to build a **standalone APK** that runs without needing Metro bundler or your computer. The JavaScript is bundled inside the APK.

## 🎯 Quick Start: Build Standalone APK

### Step 1: Build the APK
```bash
npm run android:assemble
```

### Step 2: Find Your APK
The standalone APK will be at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 3: Install on Phone
**Option A - USB:**
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

**Option B - Transfer & Install:**
1. Copy `app-release.apk` to your phone (email, USB, cloud storage)
2. On your phone: Settings → Apps → Special app access → Install unknown apps → Enable for your file manager
3. Open the APK file on your phone and install it

## 📦 What Makes It Standalone?

✅ **All JavaScript bundled** - No Metro server needed  
✅ **Optimized & minified** - Smaller file size  
✅ **No debug logs** - Production-ready  
✅ **Runs offline** - Works without computer connection  

## 🔧 Alternative Build Methods

### Build and Install Directly (Requires USB)
```bash
npm run android:release
```
Builds and installs on connected device in one step.

### Build for Google Play Store (AAB format)
```bash
npm run android:bundle
```
Creates `app-release.aab` at: `android/app/build/outputs/bundle/release/app-release.aab`

## Important: Disable Metro Bundler Logs

Before building, **stop Metro bundler** if it's running. Release builds bundle JavaScript separately and don't use Metro.

1. Stop Metro (Ctrl+C in terminal where `npm start` is running)
2. Run one of the build commands above

## What's Different in Release Builds?

✅ **Optimizations:**
- JavaScript bundle is minified
- Debug logs are stripped (no console.log output)
- Hermes engine is enabled (faster performance)
- Smaller app size

✅ **No Debug Features:**
- No Metro bundler connection
- No hot reloading
- No React DevTools
- No remote debugging
- No verbose logging

✅ **Production-Ready:**
- Real performance characteristics
- Actual storage usage patterns
- True battery consumption

## Testing Storage Issues

To diagnose if debug logging is causing system file growth:

1. **Uninstall the debug version** from your Xiaomi phone
2. **Install the release build**: 
   ```bash
   npm run android:release
   ```
3. **Monitor system storage** - if it stops growing, debug logging was the culprit

## Installing Release APK on Device

If you build the APK manually:

1. Enable "Install from Unknown Sources" on your Xiaomi phone:
   - Settings → Apps → Special app access → Install unknown apps
   - Enable for your file manager

2. Transfer APK to phone (USB, email, cloud storage)

3. Open APK file on phone and install

## Signing (For Production)

Currently using debug keystore. For production/distribution:

1. Generate a release keystore:
   ```bash
   cd android/app
   keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Update `android/app/build.gradle`:
   ```gradle
   signingConfigs {
       release {
           storeFile file('my-release-key.keystore')
           storePassword 'your-password'
           keyAlias 'my-key-alias'
           keyPassword 'your-password'
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           // ... rest of config
       }
   }
   ```

3. Create `android/gradle.properties` (if not exists) and add:
   ```
   MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
   MYAPP_RELEASE_KEY_ALIAS=my-key-alias
   MYAPP_RELEASE_STORE_PASSWORD=your-password
   MYAPP_RELEASE_KEY_PASSWORD=your-password
   ```

## Troubleshooting

**"Gradle build failed"**
- Make sure you're in the project root directory
- Try: `cd android && ./gradlew clean && cd ..`

**"Device not found"**
- Connect device via USB
- Enable USB debugging
- Run: `adb devices` to verify connection

**"App crashes on release build"**
- Check ProGuard rules in `android/app/proguard-rules.pro`
- Disable ProGuard: Set `enableProguardInReleaseBuilds = false` in `build.gradle`

