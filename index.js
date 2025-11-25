/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

// Register main app component
AppRegistry.registerComponent(appName, () => App);

// Register headless task for background BLE data collection
// This allows the app to continue receiving BLE notifications when in background
import BleManager from 'react-native-ble-manager';

const HeadlessTask = async (taskData) => {
  console.log('[Headless] Background task started:', taskData);

  // BLE Manager automatically handles notifications in background
  // Data will be queued and processed when app returns to foreground

  // Keep BLE connection alive
  try {
    const connectedPeripherals = await BleManager.getConnectedPeripherals([]);
    console.log('[Headless] Connected peripherals:', connectedPeripherals.length);
  } catch (error) {
    console.error('[Headless] Error checking peripherals:', error);
  }
};

// Register headless task for BLE events
AppRegistry.registerHeadlessTask('RNBleManagerTask', () => HeadlessTask);
