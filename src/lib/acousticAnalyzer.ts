// Autocorrelation pitch detection from raw PCM samples
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1;
  const threshold = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < threshold) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < threshold) { r2 = SIZE - i; break; }
  }

  const trimmed = buffer.slice(r1, r2);
  const len = trimmed.length;
  const c = new Float32Array(len).fill(0);
  for (let i = 0; i < len; i++) {
    for (let j = 0; j < len - i; j++) c[i] += trimmed[j] * trimmed[j + i];
  }

  let d = 0;
  while (d < len && c[d] > c[d + 1]) d++;
  let maxVal = -1, maxPos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxVal) { maxVal = c[i]; maxPos = i; }
  }
  if (maxPos < 2 || maxPos >= len - 1) return -1;

  const x1 = c[maxPos - 1], x2 = c[maxPos], x3 = c[maxPos + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  const T0 = a ? maxPos - b / (2 * a) : maxPos;
  return sampleRate / T0;
}

export function getRMS(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

export function rmsToDb(rms: number): number {
  if (rms < 0.00001) return -100;
  return Math.round(20 * Math.log10(rms));
}

export interface AcousticMetrics {
  vocalVarietyScore: number;
  pacingScore: number;
  energyScore: number;
  dynamicsScore: number;
  pauseScore: number;
  clarityScore: number;
  avgPitch: number;
  pitchRange: number;
  pitchVariance: number;
  peakDb: number;
  avgDb: number;
  dynRange: number;
  pauseRatio: number;
  wpm: number;
  wordCount: number;
  pitchHistory: number[];
}

export function computeAcousticMetrics(
  pitchHistory: number[],
  volumeHistory: number[],
  silenceFrames: number,
  durationSeconds: number,
  transcript: string
): AcousticMetrics {
  const totalFrames = volumeHistory.length || 1;
  const validPitches = pitchHistory.filter(p => p > 80 && p < 400);

  const avgPitch = validPitches.length > 0
    ? Math.round(validPitches.reduce((a, b) => a + b, 0) / validPitches.length)
    : 0;
  const pitchMin = validPitches.length > 0 ? Math.min(...validPitches) : 0;
  const pitchMax = validPitches.length > 0 ? Math.max(...validPitches) : 0;
  const pitchRange = Math.round(pitchMax - pitchMin);

  let pitchVariance = 0;
  if (validPitches.length > 2) {
    const sqDiffs = validPitches.map(p => Math.pow(p - avgPitch, 2));
    pitchVariance = Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length);
  }

  const maxVol = Math.max(...volumeHistory, 0.001);
  const avgVol = volumeHistory.reduce((a, b) => a + b, 0) / totalFrames;
  const peakDb = rmsToDb(maxVol);
  const avgDb = rmsToDb(avgVol);
  const dynRange = peakDb - rmsToDb(avgVol * 0.1);
  const pauseRatio = Math.round((silenceFrames / totalFrames) * 100);
  const speechRatio = 100 - pauseRatio;

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
  const speechTime = durationSeconds * (speechRatio / 100);
  const wpm = speechTime > 5 ? Math.round((wordCount / speechTime) * 60) : 0;

  const vocalVarietyScore = Math.min(100, Math.round(
    (Math.min(pitchRange, 150) / 150) * 50 +
    (Math.min(pitchVariance, 40) / 40) * 50
  ));

  let pacingScore = 50;
  if (wpm >= 130 && wpm <= 160) pacingScore = 100;
  else if (wpm >= 100 && wpm < 130) pacingScore = Math.round(60 + (wpm - 100) / 30 * 40);
  else if (wpm > 160 && wpm <= 200) pacingScore = Math.round(100 - (wpm - 160) / 40 * 40);
  else if (wpm < 100 && wpm > 0) pacingScore = Math.round(40 + (wpm / 100) * 20);
  else if (wpm > 200) pacingScore = Math.round(60 - (wpm - 200) / 100 * 40);

  let pauseScore = 100;
  if (pauseRatio < 15) pauseScore = Math.round(50 + (pauseRatio / 15) * 50);
  else if (pauseRatio > 35) pauseScore = Math.round(100 - (pauseRatio - 35) / 65 * 60);

  const energyScore = Math.max(20, Math.min(100, Math.round((avgVol / 0.08) * 100)));

  const dynamicsScore = Math.min(100, Math.round((Math.max(dynRange, 0) / 20) * 100));

  const clarityScore = validPitches.length > 0
    ? Math.min(100, Math.round((validPitches.length / (totalFrames * 0.5)) * 80))
    : 30;

  return {
    vocalVarietyScore, pacingScore, energyScore,
    dynamicsScore, pauseScore, clarityScore,
    avgPitch, pitchRange, pitchVariance: Math.round(pitchVariance),
    peakDb, avgDb, dynRange: Math.max(0, dynRange),
    pauseRatio, wpm, wordCount,
    pitchHistory: validPitches,
  };
}
