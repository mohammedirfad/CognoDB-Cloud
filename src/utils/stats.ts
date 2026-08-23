export interface LatencyStats {
  count: number;
  meanMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  stdDevMs: number;
}

/**
 * Nearest-rank percentile over a sorted-in-place copy of samples.
 * Deliberately simple and dependency-free so results are easy to audit.
 */
export function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const idx = Math.min(Math.max(rank, 0), sorted.length - 1);
  return sorted[idx];
}

export function summarize(samplesMs: number[]): LatencyStats {
  if (samplesMs.length === 0) {
    return { count: 0, meanMs: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, stdDevMs: 0 };
  }
  const mean = samplesMs.reduce((a, b) => a + b, 0) / samplesMs.length;
  const variance =
    samplesMs.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samplesMs.length;
  return {
    count: samplesMs.length,
    meanMs: round2(mean),
    minMs: round2(Math.min(...samplesMs)),
    maxMs: round2(Math.max(...samplesMs)),
    p50Ms: round2(percentile(samplesMs, 50)),
    p95Ms: round2(percentile(samplesMs, 95)),
    p99Ms: round2(percentile(samplesMs, 99)),
    stdDevMs: round2(Math.sqrt(variance)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** High-resolution stopwatch for a single query timing. */
export function startTimer(): () => number {
  const start = process.hrtime.bigint();
  return () => Number(process.hrtime.bigint() - start) / 1_000_000; // ms
}
