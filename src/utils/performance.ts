export class PerformanceMonitor {
  private static measurements: Map<string, number> = new Map();

  static startMeasurement(name: string): void {
    this.measurements.set(name, Date.now());
  }

  static endMeasurement(name: string): number | null {
    const startTime = this.measurements.get(name);
    if (!startTime) return null;

    const duration = Date.now() - startTime;
    this.measurements.delete(name);
    
    if (__DEV__) {
      console.log(`Performance: ${name} took ${duration}ms`);
    }

    return duration;
  }

  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasurement(name);
    return fn().finally(() => {
      this.endMeasurement(name);
    });
  }

  static measure<T>(name: string, fn: () => T): T {
    this.startMeasurement(name);
    try {
      return fn();
    } finally {
      this.endMeasurement(name);
    }
  }
}