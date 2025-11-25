// src/utils/FileExporter.ts - File export utility using native Android APIs
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const { FileExportModule } = NativeModules;

export class FileExporter {
  /**
   * Request storage permissions on Android
   */
  static async requestStoragePermission(): Promise<boolean> {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 33) {
        // Android 13+ doesn't need WRITE_EXTERNAL_STORAGE
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'App needs access to save export files',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.error('Permission error:', err);
      return false;
    }
  }

  /**
   * Save data to Downloads folder using native file writing
   * Works on Android without requiring react-native-fs
   */
  static async saveToDownloads(
    data: string,
    filename: string,
    mimeType: string = 'text/plain'
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Request permissions
      const hasPermission = await this.requestStoragePermission();
      if (!hasPermission) {
        return {
          success: false,
          error: 'Storage permission denied',
        };
      }

      // Use blob and download approach for web-like behavior
      if (Platform.OS === 'android') {
        // Create file using Android's native file system
        const result = await this.writeFileAndroid(data, filename, mimeType);
        return result;
      } else {
        return {
          success: false,
          error: 'iOS not yet supported',
        };
      }
    } catch (error) {
      console.error('File save error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Android-specific file writing using JavascriptInterface
   */
  private static async writeFileAndroid(
    data: string,
    filename: string,
    mimeType: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    return new Promise((resolve) => {
      try {
        if (!NativeModules.FileExportModule) {
          resolve({
            success: false,
            error: 'FileExportModule native module not found. Please rebuild the app.',
          });
          return;
        }

        const base64Data = Buffer.from(data, 'utf8').toString('base64');

        NativeModules.FileExportModule.saveToDownloads(
          base64Data,
          filename,
          mimeType,
          (error: string, path: string) => {
            if (error) {
              console.error('FileExportModule error:', error);
              resolve({ success: false, error });
            } else {
              resolve({ success: true, path });
            }
          }
        );
      } catch (error) {
        console.error('FileExporter exception:', error);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        });
      }
    });
  }

  /**
   * Export CSV data to Downloads folder
   */
  static async exportCSV(
    data: string,
    sessionName: string = 'export'
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `HeartRate_${sessionName}_${timestamp}.csv`;
    return this.saveToDownloads(data, filename, 'text/csv');
  }

  /**
   * Export JSON data to Downloads folder
   */
  static async exportJSON(
    data: string,
    sessionName: string = 'export'
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const filename = `HeartRate_${sessionName}_${timestamp}.json`;
    return this.saveToDownloads(data, filename, 'application/json');
  }
}
