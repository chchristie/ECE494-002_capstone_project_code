// src/utils/hrvCalculations.ts - Heart Rate Variability calculations for academic research

export interface HRVMetrics {
  rmssd: number;        // Root Mean Square of Successive Differences (ms)
  sdnn: number;         // Standard Deviation of NN intervals (ms)
  pnn50: number;        // Percentage of successive RR intervals differing by >50ms
  meanRR: number;       // Mean RR interval (ms)
  meanHR: number;       // Mean heart rate (BPM)
  rrIntervals: number[];  // All RR intervals used
  validSamples: number;   // Number of valid RR intervals
}

/**
 * Calculate HRV metrics from RR intervals
 * @param rrIntervals - Array of RR intervals in milliseconds
 * @returns HRV metrics object or null if insufficient data
 */
export function calculateHRV(rrIntervals: number[]): HRVMetrics | null {
  // Need at least 5 valid RR intervals for meaningful HRV
  if (!rrIntervals || rrIntervals.length < 5) {
    return null;
  }

  // Filter out physiologically impossible RR intervals
  // Normal range: 300ms (200 BPM) to 2000ms (30 BPM)
  const validIntervals = rrIntervals.filter(rr => rr >= 300 && rr <= 2000);

  if (validIntervals.length < 5) {
    return null;
  }

  // Calculate mean RR interval
  const meanRR = validIntervals.reduce((sum, rr) => sum + rr, 0) / validIntervals.length;

  // Calculate mean heart rate (60000 ms per minute / mean RR)
  const meanHR = 60000 / meanRR;

  // Calculate SDNN (Standard Deviation of NN intervals)
  const variance = validIntervals.reduce((sum, rr) => {
    const diff = rr - meanRR;
    return sum + (diff * diff);
  }, 0) / validIntervals.length;
  const sdnn = Math.sqrt(variance);

  // Calculate successive differences for RMSSD and pNN50
  const successiveDifferences: number[] = [];
  let nn50Count = 0;

  for (let i = 1; i < validIntervals.length; i++) {
    const diff = validIntervals[i] - validIntervals[i - 1];
    successiveDifferences.push(diff);

    // Count differences > 50ms for pNN50
    if (Math.abs(diff) > 50) {
      nn50Count++;
    }
  }

  // Calculate RMSSD (Root Mean Square of Successive Differences)
  const squaredDiffs = successiveDifferences.map(diff => diff * diff);
  const meanSquaredDiff = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / squaredDiffs.length;
  const rmssd = Math.sqrt(meanSquaredDiff);

  // Calculate pNN50 (percentage)
  const pnn50 = (nn50Count / successiveDifferences.length) * 100;

  return {
    rmssd: Math.round(rmssd * 10) / 10,    // Round to 1 decimal
    sdnn: Math.round(sdnn * 10) / 10,
    pnn50: Math.round(pnn50 * 10) / 10,
    meanRR: Math.round(meanRR),
    meanHR: Math.round(meanHR),
    rrIntervals: validIntervals,
    validSamples: validIntervals.length,
  };
}

/**
 * Interpret HRV metrics for health status
 * @param hrv - HRV metrics object
 * @returns Interpretation string
 */
export function interpretHRV(hrv: HRVMetrics): {
  rmssdStatus: 'low' | 'normal' | 'high';
  sdnnStatus: 'low' | 'normal' | 'high';
  overallStatus: 'poor' | 'fair' | 'good' | 'excellent';
  interpretation: string;
} {
  // RMSSD interpretation (general population norms)
  // Low: <20ms, Normal: 20-50ms, High: >50ms
  let rmssdStatus: 'low' | 'normal' | 'high';
  if (hrv.rmssd < 20) rmssdStatus = 'low';
  else if (hrv.rmssd <= 50) rmssdStatus = 'normal';
  else rmssdStatus = 'high';

  // SDNN interpretation
  // Low: <50ms, Normal: 50-100ms, High: >100ms
  let sdnnStatus: 'low' | 'normal' | 'high';
  if (hrv.sdnn < 50) sdnnStatus = 'low';
  else if (hrv.sdnn <= 100) sdnnStatus = 'normal';
  else sdnnStatus = 'high';

  // Overall status
  let overallStatus: 'poor' | 'fair' | 'good' | 'excellent';
  if (rmssdStatus === 'low' && sdnnStatus === 'low') {
    overallStatus = 'poor';
  } else if (rmssdStatus === 'low' || sdnnStatus === 'low') {
    overallStatus = 'fair';
  } else if (rmssdStatus === 'normal' && sdnnStatus === 'normal') {
    overallStatus = 'good';
  } else {
    overallStatus = 'excellent';
  }

  const interpretation = `RMSSD ${hrv.rmssd}ms (${rmssdStatus}), SDNN ${hrv.sdnn}ms (${sdnnStatus}). Overall HRV is ${overallStatus}.`;

  return {
    rmssdStatus,
    sdnnStatus,
    overallStatus,
    interpretation,
  };
}

/**
 * Calculate HRV from heart rate readings (extract RR intervals)
 * @param heartRates - Array of heart rate values in BPM
 * @returns HRV metrics or null
 */
export function calculateHRVFromHeartRates(heartRates: number[]): HRVMetrics | null {
  if (!heartRates || heartRates.length < 5) {
    return null;
  }

  // Convert heart rates to RR intervals (60000 / HR)
  const rrIntervals = heartRates
    .filter(hr => hr > 0 && hr < 220)  // Valid heart rate range
    .map(hr => 60000 / hr);

  return calculateHRV(rrIntervals);
}
