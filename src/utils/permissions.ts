// src/utils/permissions.ts
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

export interface PermissionResult {
  granted: boolean;
  message?: string;
}

export class PermissionManager {
  static async requestBluetoothPermissions(): Promise<PermissionResult> {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ];

        const results = await PermissionsAndroid.requestMultiple(permissions);
        
        const allGranted = Object.values(results).every(
          result => result === PermissionsAndroid.RESULTS.GRANTED
        );

        if (!allGranted) {
          return {
            granted: false,
            message: 'Bluetooth permissions are required to connect to heart rate monitors',
          };
        }

        return { granted: true };
      } catch (error) {
        console.error('Permission request failed:', error);
        return {
          granted: false,
          message: 'Failed to request permissions',
        };
      }
    }

    // iOS handles permissions differently
    return { granted: true };
  }

  static async checkBluetoothPermissions(): Promise<PermissionResult> {
    if (Platform.OS === 'android') {
      try {
        const permissions = [
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ];

        const results = await Promise.all(
          permissions.map(permission => PermissionsAndroid.check(permission))
        );

        const allGranted = results.every(result => result);

        return {
          granted: allGranted,
          message: allGranted ? undefined : 'Some permissions are missing',
        };
      } catch (error) {
        console.error('Permission check failed:', error);
        return { granted: false, message: 'Failed to check permissions' };
      }
    }

    return { granted: true };
  }

  static showPermissionAlert(message: string): void {
    Alert.alert(
      'Permissions Required',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Settings', onPress: () => {
          // Open app settings
          Linking.openSettings().catch(err => {
            console.error('Failed to open settings:', err);
          });
        }},
      ]
    );
  }
}

