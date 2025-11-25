#!/bin/bash
# Script to easily test the Heart Rate Monitor app on Android Emulator

set -e  # Exit on error

echo "🚀 Heart Rate Monitor - Emulator Test Script"
echo "=============================================="
echo ""

# Set Android SDK path
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Check if emulator is available
if [ ! -f "$ANDROID_HOME/emulator/emulator" ]; then
    echo "❌ Error: Android Emulator not found"
    echo "Please install Android Studio and SDK"
    exit 1
fi

# List available AVDs
echo "📱 Available Android Virtual Devices:"
$ANDROID_HOME/emulator/emulator -list-avds
echo ""

# Get the first AVD (or use the one we know exists)
AVD_NAME="Medium_Phone_API_36.1"

# Check if emulator is already running
if $ANDROID_HOME/platform-tools/adb devices | grep -q "emulator"; then
    echo "✅ Emulator is already running"
else
    echo "🔄 Starting emulator: $AVD_NAME"
    echo "   (This may take 1-2 minutes...)"
    $ANDROID_HOME/emulator/emulator -avd "$AVD_NAME" -no-snapshot-load > /dev/null 2>&1 &
    
    # Wait for emulator to boot
    echo "⏳ Waiting for emulator to boot..."
    $ANDROID_HOME/platform-tools/adb wait-for-device
    
    # Wait a bit more for full boot
    sleep 10
    echo "✅ Emulator is ready!"
fi

echo ""
echo "📦 Building and installing app..."
echo ""

# Build and run the app
cd "$(dirname "$0")"
npx react-native run-android

echo ""
echo "✅ App should now be running on the emulator!"
echo ""
echo "💡 Tips:"
echo "   - Press Cmd+M in the app to open React Native dev menu"
echo "   - Enable 'Live Reload' or 'Fast Refresh' for instant updates"
echo "   - Check terminal for Metro bundler logs"
echo ""

