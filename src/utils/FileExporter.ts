// src/utils/FileExporter.ts - File export utility using native Android APIs
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { Buffer } from 'buffer';

const { FileExportModule } = NativeModules;

// Note: FileExportModule would require native Android/iOS implementation
// Currently using Share API instead for exports

export class FileExporter {
  /**
   * Request storage permissions on Android
   */
  static async requestStoragePermission(): Promise<boolean> {
    console.log('🔐 [FileExporter] requestStoragePermission called');
    console.log('🔐 [FileExporter] Platform:', Platform.OS);
    
    if (Platform.OS !== 'android') {
      console.log('🔐 [FileExporter] Not Android, permission granted by default');
      return true;
    }

    try {
      console.log('🔐 [FileExporter] Android version:', Platform.Version);
      
      if (Platform.Version >= 33) {
        console.log('🔐 [FileExporter] Android 13+, no WRITE_EXTERNAL_STORAGE needed');
        // Android 13+ doesn't need WRITE_EXTERNAL_STORAGE
        return true;
      }

      console.log('🔐 [FileExporter] Requesting WRITE_EXTERNAL_STORAGE permission...');
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

      console.log('🔐 [FileExporter] Permission result:', granted);
      const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
      console.log('🔐 [FileExporter] Permission granted:', isGranted);
      return isGranted;
    } catch (err) {
      console.error('❌ [FileExporter] Permission error:', err);
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
      console.log('📁 [FileExporter] saveToDownloads called');
      console.log('📁 [FileExporter] Filename:', filename);
      console.log('📁 [FileExporter] MIME type:', mimeType);
      console.log('📁 [FileExporter] Data size:', data.length, 'bytes');
      console.log('📁 [FileExporter] Platform:', Platform.OS);
      console.log('📁 [FileExporter] Android Version:', Platform.Version);
      
      // Request permissions
      console.log('🔐 [FileExporter] Requesting storage permission...');
      const hasPermission = await this.requestStoragePermission();
      console.log('🔐 [FileExporter] Permission result:', hasPermission);
      
      if (!hasPermission) {
        console.error('❌ [FileExporter] Storage permission denied');
        return {
          success: false,
          error: 'Storage permission denied',
        };
      }

      // Use blob and download approach for web-like behavior
      if (Platform.OS === 'android') {
        console.log('🤖 [FileExporter] Using Android native file system');
        // Create file using Android's native file system
        const result = await this.writeFileAndroid(data, filename, mimeType);
        console.log('📁 [FileExporter] Write result:', result);
        return result;
      } else {
        console.error('❌ [FileExporter] iOS not supported');
        return {
          success: false,
          error: 'iOS not yet supported',
        };
      }
    } catch (error) {
      console.error('❌ [FileExporter] File save error:', error);
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
        console.log('🤖 [FileExporter] writeFileAndroid starting...');
        console.log('🤖 [FileExporter] Checking for NativeModules.FileExportModule...');
        
        if (!NativeModules.FileExportModule) {
          console.error('❌ [FileExporter] FileExportModule not found!');
          console.log('🔍 [FileExporter] Available native modules:', Object.keys(NativeModules));
          resolve({
            success: false,
            error: 'FileExportModule native module not found. Please rebuild the app.',
          });
          return;
        }

        console.log('✅ [FileExporter] FileExportModule found');
        console.log('🔄 [FileExporter] Converting data to base64...');
        const base64Data = Buffer.from(data, 'utf8').toString('base64');
        console.log('✅ [FileExporter] Base64 size:', base64Data.length, 'bytes');

        console.log('📞 [FileExporter] Calling NativeModules.FileExportModule.saveToDownloads...');
        NativeModules.FileExportModule.saveToDownloads(
          base64Data,
          filename,
          mimeType,
          (error: string, path: string) => {
            console.log('📞 [FileExporter] Native callback received');
            if (error) {
              console.error('❌ [FileExporter] FileExportModule error:', error);
              resolve({ success: false, error });
            } else {
              console.log('✅ [FileExporter] File saved successfully!');
              console.log('📍 [FileExporter] File path:', path);
              resolve({ success: true, path });
            }
          }
        );
        console.log('📞 [FileExporter] Native call initiated, waiting for callback...');
      } catch (error) {
        console.error('❌ [FileExporter] Exception in writeFileAndroid:', error);
        console.error('❌ [FileExporter] Error stack:', error instanceof Error ? error.stack : 'No stack');
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
