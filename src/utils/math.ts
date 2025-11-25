// src/utils/math.ts
export class MathUtils {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  static round(value: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  static average(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    const sum = numbers.reduce((acc, num) => acc + num, 0);
    return sum / numbers.length;
  }

  static median(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  static standardDeviation(numbers: number[]): number | null {
    if (numbers.length === 0) return null;
    
    const avg = this.average(numbers);
    if (avg === null) return null;
    
    const squaredDiffs = numbers.map(num => Math.pow(num - avg, 2));
    const avgSquaredDiff = this.average(squaredDiffs);
    
    return avgSquaredDiff !== null ? Math.sqrt(avgSquaredDiff) : null;
  }

  static percentile(numbers: number[], percentile: number): number | null {
    if (numbers.length === 0) return null;
    
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (index === Math.floor(index)) {
      return sorted[index];
    }
    
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }
}