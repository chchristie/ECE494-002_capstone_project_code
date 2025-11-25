// src/utils/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export class StorageManager {
  static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, serializedValue);
    } catch (error) {
      console.error(`Failed to store item ${key}:`, error);
      throw new Error(`Storage operation failed for key: ${key}`);
    }
  }

  static async getItem<T>(key: string): Promise<T | null> {
    try {
      const serializedValue = await AsyncStorage.getItem(key);
      if (serializedValue === null) return null;
      return JSON.parse(serializedValue) as T;
    } catch (error) {
      console.error(`Failed to retrieve item ${key}:`, error);
      return null;
    }
  }

  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error);
      throw new Error(`Storage removal failed for key: ${key}`);
    }
  }

  static async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('Failed to clear storage:', error);
      throw new Error('Storage clear operation failed');
    }
  }

  static async getAllKeys(): Promise<string[]> {
    try {
   return [...(await AsyncStorage.getAllKeys())];
    } catch (error) {
      console.error('Failed to get all keys:', error);
      return [];
    }
  }
}