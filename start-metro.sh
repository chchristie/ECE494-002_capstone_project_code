#!/bin/bash
# Script to start Metro with proper file limits

echo "🚀 Starting Metro Bundler with optimized settings..."

# Increase file descriptor limit for this session
ulimit -n 4096

# Set environment variable to reduce watchers
export WATCHMAN_MAX_INSTANCES=1
export REACT_NATIVE_MAX_WORKERS=2

# Clear Metro cache
echo "🧹 Clearing Metro cache..."
rm -rf $TMPDIR/metro-* 2>/dev/null
rm -rf $TMPDIR/react-* 2>/dev/null
rm -rf $TMPDIR/haste-map-* 2>/dev/null

# Start Metro with reset cache
echo "📦 Starting Metro bundler..."
npx react-native start --reset-cache --max-workers=2

