// src/context/BluetoothContext.tsx - Nordic device detection and other ble components
import React, { 
  createContext, 
  useContext, 
  useReducer, 
  useCallback, 
  useEffect, 
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react';
import {
  PermissionsAndroid,
  Platform,
  NativeEventEmitter,
  NativeModules,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BleManager, { BleState } from 'react-native-ble-manager';
import {
  HeartRateData,
  SpO2Data,
  BatteryData,
  MiscData,
  AccelerometerData,
  BufferedAccelerometerData,
  STANDARD_SERVICES,
  STANDARD_CHARACTERISTICS,
  SEEDSTUDIO_SERVICES,
  SEEDSTUDIO_CHARACTERISTICS,
  NordicDataParser,
} from '../services/nordic-ble-services';
import DataManager from '../services/DataManager';

// Imports the foreground service module
const { ForegroundServiceModule } = NativeModules;

// BLE Manager setup
const BleManagerModule = NativeModules.BleManager;
const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);

// Device interfaces
interface DiscoveredDevice {
  id: string;
  name: string;
  rssi: number;
  lastSeen: Date;
  isNordic: boolean;
}

interface ConnectedDevice extends DiscoveredDevice {
  connectionTime: Date;
  subscriptions: Set<string>;
}

// Bluetooth state
interface BluetoothState {
  isEnabled: boolean;
  isScanning: boolean;
  isConnecting: boolean;
  connectedDevice: ConnectedDevice | null;
  availableDevices: DiscoveredDevice[];
  lastError: string | null;
  permissions: {
    location: boolean;
    bluetooth: boolean;
  };
}

// Sensor data stream - No read only properties
interface SensorDataStream {
  heartRate: HeartRateData | null;
  spO2: SpO2Data | null;
  battery: BatteryData | null;
  miscData: MiscData | null;
  accelerometer: AccelerometerData | null;
  lastUpdate: Date;
  dataRate: number;
  totalReadings: number;
  qualityScore: number;
}

// Actions for the reducer
type BluetoothAction = 
  | { type: 'SET_ENABLED'; payload: boolean }
  | { type: 'SET_SCANNING'; payload: boolean }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_CONNECTED_DEVICE'; payload: ConnectedDevice | null }
  | { type: 'ADD_DISCOVERED_DEVICE'; payload: DiscoveredDevice }
  | { type: 'UPDATE_DEVICE_RSSI'; payload: { id: string; rssi: number } }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PERMISSIONS'; payload: { location: boolean; bluetooth: boolean } }
  | { type: 'CLEAR_DEVICES' };

// Sets initial states
const initialState: BluetoothState = {
  isEnabled: false,
  isScanning: false,
  isConnecting: false,
  connectedDevice: null,
  availableDevices: [],
  lastError: null,
  permissions: {
    location: false,
    bluetooth: false,
  },
};

const initialSensorData: SensorDataStream = {
  heartRate: null,
  spO2: null,
  battery: null,
  miscData: null,
  accelerometer: null,
  lastUpdate: new Date(),
  dataRate: 0,
  totalReadings: 0,
  qualityScore: 0,
};

// Reducer used 
const bluetoothReducer = (state: BluetoothState, action: BluetoothAction): BluetoothState => {
  switch (action.type) {
    case 'SET_ENABLED':
      return { ...state, isEnabled: action.payload };
    
    case 'SET_SCANNING':
      return { ...state, isScanning: action.payload };
    
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload };
    
    case 'SET_CONNECTED_DEVICE':
      return { 
        ...state, 
        connectedDevice: action.payload, 
        isConnecting: false,
        lastError: action.payload ? null : state.lastError 
      };
    
    case 'ADD_DISCOVERED_DEVICE': {
      const existingIndex = state.availableDevices.findIndex(d => d.id === action.payload.id);
      if (existingIndex >= 0) {
        const updated = [...state.availableDevices];
        updated[existingIndex] = { ...updated[existingIndex], ...action.payload, lastSeen: new Date() };
        return { ...state, availableDevices: updated };
      }
      return { ...state, availableDevices: [...state.availableDevices, action.payload] };
    }
    
    case 'UPDATE_DEVICE_RSSI': {
      const updated = state.availableDevices.map(device => 
        device.id === action.payload.id 
          ? { ...device, rssi: action.payload.rssi, lastSeen: new Date() }
          : device
      );
      return { ...state, availableDevices: updated };
    }
    
    case 'SET_ERROR':
      return { ...state, lastError: action.payload };
    
    case 'SET_PERMISSIONS':
      return { ...state, permissions: action.payload };
    
    case 'CLEAR_DEVICES':
      return { ...state, availableDevices: [] };
    
    default:
      return state;
  }
};

// Context interface with all the required properties including session management
interface BluetoothContextValue {
  state: BluetoothState;
  sensorData: SensorDataStream;
  activeSessionId: string | null;
  isConnected: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  checkBluetoothState: () => Promise<boolean>;
  requestPermissions: () => Promise<boolean>;
  startScan: () => Promise<void>;
  stopScan: () => void;
  connectToDevice: (deviceId: string) => Promise<boolean>;
  disconnectDevice: () => Promise<void>;
  subscribeToHeartRate: (deviceId?: string) => Promise<boolean>;
  subscribeToSpO2: (deviceId?: string) => Promise<boolean>;
  subscribeToBattery: (deviceId?: string) => Promise<boolean>;
  subscribeToAccelerometer: (deviceId?: string) => Promise<boolean>;
  writeControlCharacteristic: (sensorReset: boolean, deviceReset: boolean) => Promise<boolean>;
  getNordicDevices: () => DiscoveredDevice[];
  getConnectionQuality: () => number;
}

// Creates context
const BluetoothContext = createContext<BluetoothContextValue | null>(null);

// A UUID comparison helper (case-insensitive, handles both 16-bit and the 128-bit UUIDs) since their was early difficulty sensing which it was out putting
const uuidMatches = (uuid1: string, uuid2: string): boolean => {
  if (!uuid1 || !uuid2) return false;

  // Normalizes the UUIDs by removing dashes and converting to uppercase
  const normalize = (uuid: string) => uuid.replace(/-/g, '').toUpperCase();
  const normalized1 = normalize(uuid1);
  const normalized2 = normalize(uuid2);

  // Direct match
  if (normalized1 === normalized2) return true;

  // Checks if one is 16-bit and the other is 128-bit 
  // Standard BLE 16-bit UUIDs are then expanded to: 0000XXXX-0000-1000-8000-00805F9B34FB
  const bleBase = '0000100080' + '00' + '00805F9B34FB';

  if (normalized1.length === 4 && normalized2.length === 32) {
    // uuid1 is 16-bit, uuid2 is 128-bit
    const expanded1 = '0000' + normalized1 + bleBase;
    return expanded1 === normalized2;
  }

  if (normalized2.length === 4 && normalized1.length === 32) {
    // uuid2 is 16-bit, uuid1 is 128-bit
    const expanded2 = '0000' + normalized2 + bleBase;
    return normalized1 === expanded2;
  }

  return false;
};

// Checks if device is advertising the HRM or SpO2 service- for debugging bothe the protype and the app
const isCompatibleDevice = (device: any): boolean => {
  const advertisedServices = device.advertising?.serviceUUIDs || [];
  
  const hasHeartRateService = advertisedServices.some((service: string) =>
    uuidMatches(service, STANDARD_SERVICES.HEART_RATE) ||
    uuidMatches(service, `0000${STANDARD_SERVICES.HEART_RATE}`)
  );

  const hasSpO2Service = advertisedServices.some((service: string) =>
    uuidMatches(service, STANDARD_SERVICES.PULSE_OXIMETER) ||
    uuidMatches(service, `0000${STANDARD_SERVICES.PULSE_OXIMETER}`)
  );

  return hasHeartRateService || hasSpO2Service;
};

// All data parsing should now be using NordicDataParser for consistency
// imports from nordic-ble-services.ts

// Provider component
export const BluetoothProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(bluetoothReducer, initialState);
  const [sensorData, setSensorData] = useState<SensorDataStream>(initialSensorData);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const dataRateRef = useRef<{ lastUpdate: number; count: number }>({ lastUpdate: Date.now(), count: 0 });
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValidHeartRateRef = useRef<number>(Date.now()); // Track last valid (>30) heart rate timestamp to ignore false readings

  // Buffer for batching database writes - ACCUMULATE all sensor types into ONE object for the csv 
  const dbWriteBufferRef = useRef<{
    hr?: HeartRateData;
    spo2?: SpO2Data;
    battery?: BatteryData;
    misc?: MiscData;
    lastUpdate: number;
  }>({ lastUpdate: Date.now() });
  const dbWriteTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Tracks which notifications have been received in current cycle
  // Notification order: HR -> SpO2 -> Battery (every 2 seconds) 0.5hz
  // Accelerometer is independent and sent every 200ms to get more precise readings
  const cycleTrackingRef = useRef<{
    receivedHR: boolean;
    receivedSpO2: boolean;
    receivedBattery: boolean;
  }>({
    receivedHR: false,
    receivedSpO2: false,
    receivedBattery: false,
  });

  // BLE initialization and event listeners
  useEffect(() => {
    const initializeBLE = async () => {
      try {
        await BleManager.start({ showAlert: false });
        console.log('BLE Manager initialized');
        
        const isEnabled = await checkBluetoothState();
        dispatch({ type: 'SET_ENABLED', payload: isEnabled });
      } catch (error) {
        console.error('BLE initialization error:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to initialize Bluetooth' });
      }
    };

    initializeBLE();

    // Event handlers
    const handleDiscoverPeripheral = (peripheral: any) => {
      const device: DiscoveredDevice = {
        id: peripheral.id,
        name: peripheral.name || 'Unknown Device',
        rssi: peripheral.rssi,
        lastSeen: new Date(),
        isNordic: isCompatibleDevice(peripheral),
      };

      if (device.isNordic) {
        dispatch({ type: 'ADD_DISCOVERED_DEVICE', payload: device });
      }
    };

    const handleUpdatePeripheral = (peripheral: any) => {
      dispatch({ 
        type: 'UPDATE_DEVICE_RSSI', 
        payload: { id: peripheral.id, rssi: peripheral.rssi } 
      });
    };

    const handleDisconnectPeripheral = (data: any) => {
      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
      setSensorData(initialSensorData);

      if (Platform.OS === 'android' && ForegroundServiceModule) {
        ForegroundServiceModule.stopMonitoring()
          .catch((err: any) => console.error('Could not stop foreground service:', err));
      }

      if (activeSessionId) {
        DataManager.endSession(activeSessionId)
          .then(() => {
            setActiveSessionId(null);
          })
          .catch(() => {});
      }
    };

    const handleCharacteristicValueUpdate = (data: any) => {
      if (!state.connectedDevice || data.peripheral !== state.connectedDevice.id) {
        return;
      }

      const { service, characteristic, value } = data;

      try {
        let heartRateUpdate: HeartRateData | null = null;
        let spO2Update: SpO2Data | null = null;
        let batteryUpdate: BatteryData | null = null;
        let miscUpdate: MiscData | null = null;
        let accelerometerUpdate: AccelerometerData | null = null;
        let bufferedAccelUpdate: BufferedAccelerometerData[] | null = null;

        // Parses Heart Rate data - using NordicDataParser
        if (uuidMatches(service, STANDARD_SERVICES.HEART_RATE) &&
            uuidMatches(characteristic, STANDARD_CHARACTERISTICS.HEART_RATE_MEASUREMENT)) {
          const buffer = new Uint8Array(value);
          heartRateUpdate = NordicDataParser.parseHeartRateData(buffer, state.connectedDevice.id);
        }

        // Parsing SpO2 from PULSE_OXIMETER service (0x1822) - using NordicDataParser
        else if (uuidMatches(service, STANDARD_SERVICES.PULSE_OXIMETER) &&
                 uuidMatches(characteristic, STANDARD_CHARACTERISTICS.PLX_CONTINUOUS_MEASUREMENT)) {
          const buffer = new Uint8Array(value);
          spO2Update = NordicDataParser.parseSpO2Data(buffer, state.connectedDevice.id);
        }

        // Parsing Battery data - using NordicDataParser
        else if (uuidMatches(service, STANDARD_SERVICES.BATTERY_SERVICE) &&
                 uuidMatches(characteristic, STANDARD_CHARACTERISTICS.BATTERY_LEVEL)) {
          const buffer = new Uint8Array(value);
          batteryUpdate = NordicDataParser.parseBatteryData(buffer, state.connectedDevice.id);
        }

        // Parsing Miscellaneous data (status, confidence, voltage) - using NordicDataParser
        else if (uuidMatches(service, SEEDSTUDIO_SERVICES.ACCELEROMETER_SERVICE) &&
                 uuidMatches(characteristic, SEEDSTUDIO_CHARACTERISTICS.MISC_DATA)) {
          const buffer = new Uint8Array(value);
          miscUpdate = NordicDataParser.parseMiscData(buffer, state.connectedDevice.id);
        }

        // Parses the buffered accelerometer data (124 bytes) from custom service
        else if (uuidMatches(service, SEEDSTUDIO_SERVICES.ACCELEROMETER_SERVICE) &&
                 uuidMatches(characteristic, SEEDSTUDIO_CHARACTERISTICS.ACCELEROMETER_DATA)) {
          const buffer = new Uint8Array(value);
          
          // Then parses all 20 samples from the 124-byte packet 
          bufferedAccelUpdate = NordicDataParser.parseBufferedAccelerometerData(buffer, state.connectedDevice.id);
          // For the UI display, use the first sample
          if (bufferedAccelUpdate && bufferedAccelUpdate.length > 0) {
            accelerometerUpdate = bufferedAccelUpdate[0];
          }
        }

        if (heartRateUpdate || spO2Update || batteryUpdate || miscUpdate || accelerometerUpdate) {
          // Tracks last valid heart rate for UI purposes 
          if (heartRateUpdate && heartRateUpdate.heartRate > 30) {
            lastValidHeartRateRef.current = Date.now();
          }

          if (activeSessionId) {
            // Helper function to flush buffer to database for debugging
            const flushBuffer = (missedNotifications: string[] = []) => {
              const buffer = dbWriteBufferRef.current;
              
              if (missedNotifications.length > 0) {
                console.log('⚠️ [Buffer] Missed notifications:', missedNotifications.join(', '));
              }
              
              // Saves HR, SpO2, Battery, Misc to sensor_readings table
              if (buffer.hr || buffer.spo2 || buffer.battery || buffer.misc) {
                DataManager.saveNordicReading(
                  activeSessionId,
                  buffer.hr,
                  buffer.spo2,
                  buffer.battery,
                  buffer.misc,
                ).catch((err) => {
                  console.error('Failed to save reading:', err);
                });
              }
              
              // Resets the buffer and cycle tracking
              dbWriteBufferRef.current = { lastUpdate: Date.now() };
              cycleTrackingRef.current = {
                receivedHR: false,
                receivedSpO2: false,
                receivedBattery: false,
              };
            };

            // Checks for missed notifications for errors
            const missedNotifications: string[] = [];
            
            if (heartRateUpdate) {
              // Sets logic for it has already received HR in this cycle, the its missed Battery from the previous cycle
              if (cycleTrackingRef.current.receivedHR) {
                if (!cycleTrackingRef.current.receivedBattery) missedNotifications.push('Battery');
                flushBuffer(missedNotifications);
              }
              dbWriteBufferRef.current.hr = heartRateUpdate;
              cycleTrackingRef.current.receivedHR = true;
            }
            
            if (spO2Update) {
              // If it gets SpO2 without first getting HR, previous cycle was incomplete
              if (!cycleTrackingRef.current.receivedHR && cycleTrackingRef.current.receivedBattery) {
                if (!cycleTrackingRef.current.receivedHR) missedNotifications.push('HeartRate');
                flushBuffer(missedNotifications);
              }
              dbWriteBufferRef.current.spo2 = spO2Update;
              cycleTrackingRef.current.receivedSpO2 = true;
            }
            
            if (miscUpdate) {
              dbWriteBufferRef.current.misc = miscUpdate;
            }
            
            if (batteryUpdate) {
              dbWriteBufferRef.current.battery = batteryUpdate;
              cycleTrackingRef.current.receivedBattery = true;
              
              // Capture buffer values BEFORE flushing 
              const capturedHR = dbWriteBufferRef.current.hr;
              const capturedSpO2 = dbWriteBufferRef.current.spo2;
              const capturedBattery = dbWriteBufferRef.current.battery;
              const capturedMisc = dbWriteBufferRef.current.misc;
              
              // Battery is the last notification in the cycle - flush buffer
              flushBuffer();
              
              // Force the UI update after flush with all the vitals
              // This ensures all panels update together for clarityand to keep csv simplified
              const now = Date.now();
              setSensorData(prev => {
                const timeDiff = now - dataRateRef.current.lastUpdate;
                dataRateRef.current.count++;

                const dataRate = timeDiff > 1000 ?
                  Math.round((dataRateRef.current.count / (timeDiff / 1000)) * 10) / 10 : prev.dataRate;

                if (timeDiff > 5000) {
                  dataRateRef.current = { lastUpdate: now, count: 0 };
                }

                return {
                  heartRate: capturedHR || prev.heartRate,
                  spO2: capturedSpO2 || prev.spO2,
                  battery: capturedBattery || prev.battery,
                  miscData: capturedMisc || prev.miscData,
                  accelerometer: prev.accelerometer,
                  lastUpdate: new Date(),
                  dataRate,
                  totalReadings: prev.totalReadings + 1,
                  qualityScore: 0,
                };
              });
            }
            
            // Accelerometer is independent and saves immediately to a separate table
            if (accelerometerUpdate && bufferedAccelUpdate && bufferedAccelUpdate.length > 0) {
              //console.log(`💾 [Accel] Saving ${bufferedAccelUpdate.length} buffered accel samples`);
               DataManager.saveAccelerometerReadings(
                activeSessionId,
                bufferedAccelUpdate
              ).catch((err) => {
                console.error('Failed to save buffered accelerometer readings:', err);
              });
            }

            dbWriteBufferRef.current.lastUpdate = Date.now();
          }

          // Throttles UI updates to max 10 per second (100ms interval)
          // BUT always immeaditly updates when it has new accelerometer data
          const now = Date.now();
          //const timeSinceLastUiUpdate = now - lastUiUpdateRef.current;

          if (heartRateUpdate || accelerometerUpdate) {
          //  lastUiUpdateRef.current = now;

            setSensorData(prev => {
              const timeDiff = now - dataRateRef.current.lastUpdate;
              dataRateRef.current.count++;

              const dataRate = timeDiff > 1000 ?
                Math.round((dataRateRef.current.count / (timeDiff / 1000)) * 10) / 10 : prev.dataRate;

              if (timeDiff > 5000) {
                dataRateRef.current = { lastUpdate: now, count: 0 };
              }

              const newHeartRate = heartRateUpdate || prev.heartRate;
              const newSpO2 = spO2Update || prev.spO2;
              const newBattery = batteryUpdate || prev.battery;
              const newMiscData = miscUpdate || prev.miscData;

              // For accelerometer, always create new object if it has an update
              // This ensures React detects the changes
              const newAccelerometer = accelerometerUpdate 
                ? { ...accelerometerUpdate }
                : prev.accelerometer;



              return {
                heartRate: newHeartRate,
                spO2: newSpO2,
                battery: newBattery,
                miscData: newMiscData,
                accelerometer: newAccelerometer,
                lastUpdate: new Date(),
                dataRate,
                totalReadings: prev.totalReadings + 1,
                qualityScore: 0,  // Signal quality has been removed
              };
            });
          }
        }
        
      } catch (error) {
        console.error('Data parsing error:', error);
      }
    };

    // Subscribes to BLE events
    const listeners = [
      BleManagerEmitter.addListener('BleManagerDiscoverPeripheral', handleDiscoverPeripheral),
      BleManagerEmitter.addListener('BleManagerDidUpdatePeripheral', handleUpdatePeripheral),
      BleManagerEmitter.addListener('BleManagerDisconnectPeripheral', handleDisconnectPeripheral),
      BleManagerEmitter.addListener('BleManagerDidUpdateValueForCharacteristic', handleCharacteristicValueUpdate),
    ];

    return () => {
      listeners.forEach(listener => listener.remove());
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (dbWriteTimerRef.current) {
        clearTimeout(dbWriteTimerRef.current);
        // Flushes any remaining buffered data
        const buffer = dbWriteBufferRef.current;
        if (activeSessionId && (buffer.hr || buffer.spo2 || buffer.battery || buffer.misc)) {
          DataManager.saveNordicReading(
            activeSessionId,
            buffer.hr,
            buffer.spo2,
            buffer.battery,
            buffer.misc,
          ).catch(() => {});
        }
      }
    };
  }, [state.connectedDevice?.id, activeSessionId]);

  // Core functions
  const checkBluetoothState = useCallback(async (): Promise<boolean> => {
    try {
      const bleState = await BleManager.checkState();
      const isEnabled = bleState === BleState.On;
      dispatch({ type: 'SET_ENABLED', payload: isEnabled });
      return isEnabled;
    } catch (error) {
      console.error('Bluetooth state check error:', error);
      return false;
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      dispatch({ type: 'SET_PERMISSIONS', payload: { location: true, bluetooth: true } });
      return true;
    }

    try {
      const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

      if (Platform.Version >= 31) {
        permissions.push(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
        );
      }

      const granted = await PermissionsAndroid.requestMultiple(permissions);
      
      const hasAllPermissions = Object.values(granted).every(
        permission => permission === PermissionsAndroid.RESULTS.GRANTED
      );

      dispatch({ 
        type: 'SET_PERMISSIONS', 
        payload: { location: hasAllPermissions, bluetooth: hasAllPermissions } 
      });

      return hasAllPermissions;
    } catch (error) {
      console.error('Permission request error:', error);
      return false;
    }
  }, []);

  const startScan = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_SCANNING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      dispatch({ type: 'CLEAR_DEVICES' });

      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        throw new Error('Required permissions not granted');
      }

      const isEnabled = await checkBluetoothState();
      if (!isEnabled) {
        throw new Error('Bluetooth is not enabled');
      }

      const scanServices = [
        STANDARD_SERVICES.HEART_RATE,      // '180D'
        STANDARD_SERVICES.PULSE_OXIMETER,  // '1822'
      ];

      await BleManager.scan(scanServices, 20, true);

      scanTimeoutRef.current = setTimeout(() => {
        stopScan();
      }, 20000); // Extended to 20 seconds for timeout

    } catch (error) {
      console.error('Scan start error:', error);
      dispatch({ type: 'SET_ERROR', payload: `Scan failed: ${error}` });
      dispatch({ type: 'SET_SCANNING', payload: false });
    }
  }, [checkBluetoothState, requestPermissions]);

  const stopScan = useCallback(() => {
    BleManager.stopScan()
      .then(() => {
        dispatch({ type: 'SET_SCANNING', payload: false });
        if (scanTimeoutRef.current) {
          clearTimeout(scanTimeoutRef.current);
          scanTimeoutRef.current = null;
        }
      })
      .catch(() => {
        dispatch({ type: 'SET_SCANNING', payload: false });
      });
  }, []);

  const connectToDevice = useCallback(async (deviceId: string): Promise<boolean> => {
    try {
      dispatch({ type: 'SET_CONNECTING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      await BleManager.connect(deviceId);

      // Retrieves the services
      const peripheralInfo = await BleManager.retrieveServices(deviceId);
      
      const device = state.availableDevices.find(d => d.id === deviceId);
      if (!device) {
        throw new Error('Device not found in discovered list');
      }

      const connectedDevice: ConnectedDevice = {
        ...device,
        connectionTime: new Date(),
        subscriptions: new Set(),
      };

      try {
        const session = await DataManager.createSession(
          device.name,
          `Connected to ${device.name} at ${new Date().toLocaleString()}`
        );
        setActiveSessionId(session.id);
      } catch (error) {
        console.error('Could not create session:', error);
      }

      if (Platform.OS === 'android' && ForegroundServiceModule) {
        try {
          await ForegroundServiceModule.startMonitoring();
        } catch (error) {
          console.error('Could not start foreground service:', error);
        }
      }

      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: connectedDevice });

      // Auto-subscribes to all characteristics
      await subscribeToHeartRate(deviceId);
      await subscribeToSpO2(deviceId);
      await subscribeToBattery(deviceId);
      await subscribeToMiscData(deviceId);
      
      // Checks if accelerometer is enabled before subscribing
      const accelEnabled = await AsyncStorage.getItem('accelerometer_enabled');
      if (accelEnabled === null || accelEnabled === 'true') {
        // Defaults to true if not set
        await subscribeToAccelerometer(deviceId);
      } else {
        console.log('⚙️ Accelerometer disabled by user setting - skipping subscription');
      }
      
      return true;

    } catch (error) {
      console.error('Connection error:', error);
      dispatch({ type: 'SET_ERROR', payload: `Connection failed: ${error}` });
      return false;
    } finally {
      dispatch({ type: 'SET_CONNECTING', payload: false });
    }
  }, [state.availableDevices]);

  const disconnectDevice = useCallback(async (): Promise<void> => {
    if (!state.connectedDevice) return;

    try {
      // Cleans up  the polling intervals
      if ((state.connectedDevice as any).hrPollInterval) {
        clearInterval((state.connectedDevice as any).hrPollInterval);
      }

      await BleManager.disconnect(state.connectedDevice.id);

      if (Platform.OS === 'android' && ForegroundServiceModule) {
        await ForegroundServiceModule.stopMonitoring()
          .catch((err: any) => console.error('Could not stop foreground service:', err));
      }
      if (activeSessionId) {
        await DataManager.endSession(activeSessionId).catch(() => {});
        setActiveSessionId(null);
      }

      dispatch({ type: 'SET_CONNECTED_DEVICE', payload: null });
      setSensorData(initialSensorData);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Disconnect failed: ${error}` });
    }
  }, [state.connectedDevice, activeSessionId]);

  const subscribeToHeartRate = useCallback(async (deviceId?: string): Promise<boolean> => {
    const targetDeviceId = deviceId || state.connectedDevice?.id;
    if (!targetDeviceId) return false;

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      const hrChar = characteristics.find((char: any) =>
        char.characteristic.toUpperCase().includes('2A37') ||
        char.characteristic.toLowerCase() === '2a37'
      );

      if (!hrChar) {
        return false;
      }

      // Checks if Notify property exists 
      const hasNotify = hrChar.properties?.Notify === true ||
                       hrChar.properties?.Notify === "Notify";

      if (!hasNotify) {
        return false;
      }

      await BleManager.startNotification(
        targetDeviceId,
        hrChar.service,
        hrChar.characteristic
      );

      if (state.connectedDevice) {
        state.connectedDevice.subscriptions.add('heartRate');
      }
      return true;

    } catch (error) {
      return false;
    }
  }, [state.connectedDevice]);

  const subscribeToSpO2 = useCallback(async (deviceId?: string): Promise<boolean> => {
    const targetDeviceId = deviceId || state.connectedDevice?.id;
    if (!targetDeviceId) return false;

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      const spO2Char = characteristics.find((char: any) =>
        char.characteristic.toUpperCase().includes('2A5F') ||
        char.characteristic.toLowerCase() === '2a5f'
      );

      if (!spO2Char) {
        return false;
      }

      const hasNotify = spO2Char.properties?.Notify === true ||
                       spO2Char.properties?.Notify === "Notify";

      if (!hasNotify) {
        return false;
      }

      await BleManager.startNotification(
        targetDeviceId,
        spO2Char.service,
        spO2Char.characteristic
      );

      if (state.connectedDevice) {
        state.connectedDevice.subscriptions.add('spO2');
      }
      return true;
    } catch (error) {
      return false;
    }
  }, [state.connectedDevice]);

  const subscribeToBattery = useCallback(async (deviceId?: string): Promise<boolean> => {
    const targetDeviceId = deviceId || state.connectedDevice?.id;
    if (!targetDeviceId) return false;

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      const batteryChar = characteristics.find((char: any) =>
        char.characteristic.toUpperCase().includes('2A19') ||
        char.characteristic.toLowerCase() === '2a19'
      );

      if (!batteryChar) {
        return false;
      }

      const hasNotify = batteryChar.properties?.Notify === true ||
                       batteryChar.properties?.Notify === "Notify";

      if (!hasNotify) {
        return false;
      }

      await BleManager.startNotification(
        targetDeviceId,
        batteryChar.service,
        batteryChar.characteristic
      );

      if (state.connectedDevice) {
        state.connectedDevice.subscriptions.add('battery');
      }
      return true;
    } catch (error) {
      return false;
    }
  }, [state.connectedDevice]);

  const subscribeToMiscData = useCallback(async (deviceId?: string): Promise<boolean> => {
    const targetDeviceId = deviceId || state.connectedDevice?.id;
    if (!targetDeviceId) return false;

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      // Find misc data characteristic (6E400004-B5A3-F393-E0A9-E50E24DCCA9E)
      const miscDataChar = characteristics.find((char: any) =>
        char.characteristic.toUpperCase().includes('6E400004')
      );

      if (!miscDataChar) {
        return false;
      }

      const hasNotify = miscDataChar.properties?.Notify === true ||
                       miscDataChar.properties?.Notify === "Notify";

      if (!hasNotify) {
        return false;
      }

      await BleManager.startNotification(
        targetDeviceId,
        miscDataChar.service,
        miscDataChar.characteristic
      );

      if (state.connectedDevice) {
        state.connectedDevice.subscriptions.add('miscData');
      }
      return true;
    } catch (error) {
      return false;
    }
  }, [state.connectedDevice]);

  const subscribeToAccelerometer = useCallback(async (deviceId?: string): Promise<boolean> => {
    const targetDeviceId = deviceId || state.connectedDevice?.id;
    if (!targetDeviceId) return false;

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      const accelChar = characteristics.find((char: any) =>
        uuidMatches(char.service, SEEDSTUDIO_SERVICES.ACCELEROMETER_SERVICE) &&
        uuidMatches(char.characteristic, SEEDSTUDIO_CHARACTERISTICS.ACCELEROMETER_DATA)
      );

      if (!accelChar) {
        return false;
      }

      const hasNotify = accelChar.properties?.Notify === true ||
                       accelChar.properties?.Notify === "Notify";

      if (!hasNotify) {
        return false;
      }

      await BleManager.startNotification(
        targetDeviceId,
        accelChar.service,
        accelChar.characteristic
      );

      if (state.connectedDevice) {
        state.connectedDevice.subscriptions.add('accelerometer');
      }
      return true;

    } catch (error) {
      return false;
    }
  }, [state.connectedDevice]);

  const getNordicDevices = useCallback((): DiscoveredDevice[] => {
    return state.availableDevices.filter(device => device.isNordic);
  }, [state.availableDevices]);

  const writeControlCharacteristic = useCallback(async (
    sensorReset: boolean,
    deviceReset: boolean
  ): Promise<boolean> => {
    const targetDeviceId = state.connectedDevice?.id;
    if (!targetDeviceId) {
      return false;
    }

    try {
      const peripheralInfo = await BleManager.retrieveServices(targetDeviceId);
      const characteristics = (peripheralInfo as any).characteristics || [];

      const controlChar = characteristics.find((char: any) =>
        uuidMatches(char.characteristic, SEEDSTUDIO_CHARACTERISTICS.CONTROL) &&
        uuidMatches(char.service, SEEDSTUDIO_SERVICES.ACCELEROMETER_SERVICE)
      );

      if (!controlChar) {
        return false;
      }

      const hasWrite = controlChar.properties?.Write === true ||
                      controlChar.properties?.Write === "Write";

      if (!hasWrite) {
        return false;
      }

      // Create 2-byte buffer: byte 0 = sensor reset, byte 1 = device reset
      const data = new Uint8Array(2);
      data[0] = sensorReset ? 1 : 0;
      data[1] = deviceReset ? 1 : 0;

      await BleManager.write(
        targetDeviceId,
        controlChar.service,
        controlChar.characteristic,
        Array.from(data)
      );

      return true;
    } catch (error) {
      console.error('Failed to write control characteristic:', error);
      return false;
    }
  }, [state.connectedDevice]);

  const getConnectionQuality = useCallback((): number => {
    if (!state.connectedDevice) return 0;
    
    const rssi = state.connectedDevice.rssi;
    if (rssi > -30) return 100;
    if (rssi > -50) return 80;
    if (rssi > -70) return 60;
    if (rssi > -80) return 40;
    if (rssi > -90) return 20;
    return 10;
  }, [state.connectedDevice]);

  // Saves context value with session management
  const contextValue = useMemo<BluetoothContextValue>(() => ({
    state,
    sensorData,
    activeSessionId,
    isConnected: state.connectedDevice !== null,
    connectionStatus: state.isConnecting ? 'connecting' :
                     state.connectedDevice ? 'connected' : 'disconnected',
    checkBluetoothState,
    requestPermissions,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    subscribeToHeartRate,
    subscribeToSpO2,
    subscribeToBattery,
    subscribeToAccelerometer,
    writeControlCharacteristic,
    getNordicDevices,
    getConnectionQuality,
  }), [
    state,
    sensorData,
    activeSessionId,
    checkBluetoothState,
    requestPermissions,
    startScan,
    stopScan,
    connectToDevice,
    disconnectDevice,
    subscribeToHeartRate,
    subscribeToSpO2,
    subscribeToBattery,
    subscribeToAccelerometer,
    writeControlCharacteristic,
    getNordicDevices,
    getConnectionQuality,
  ]);

  return (
    <BluetoothContext.Provider value={contextValue}>
      {children}
    </BluetoothContext.Provider>
  );
};

// Custom hook
export const useBluetooth = (): BluetoothContextValue => {
  const context = useContext(BluetoothContext);
  if (!context) {
    throw new Error('useBluetooth must be used within a BluetoothProvider');
  }
  return context;
};

export default BluetoothContext;
