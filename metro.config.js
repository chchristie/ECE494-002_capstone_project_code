// metro.config.js
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const projectRoot = __dirname;

const defaultConfig = getDefaultConfig(projectRoot);

const config = {
  projectRoot: projectRoot,
  watchFolders: [projectRoot],
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    nodeModulesPaths: [path.resolve(projectRoot, 'node_modules')],
    blockList: exclusionList([
      // Exclude parent directory's node_modules completely
      /^(?!.*HeartRateMonitor_Shareable).*node_modules.*/,
      // Specifically block Documents/node_modules
      /\/Documents\/node_modules\/.*/,
      // Block expo from parent
      /.*\/node_modules\/.*\/node_modules\/@expo\/.*/,
      /.*\/node_modules\/.*\/node_modules\/expo\/.*/,
    ]),
    alias: {
      '@': './src',
    },
  },
  // Explicitly limit what Metro watches
  watcher: {
    watchman: {
      deferStates: ['hg.update'],
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);