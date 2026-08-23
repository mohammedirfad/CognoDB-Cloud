import { env } from "../config/env";
import { startTimer, summarize, LatencyStats } from "../utils/stats";

/**
 * Runs `warmupIterations` untimed calls to let connection pools, query
 * caches and JIT warm up, then times `readIterations` calls and returns
 * percentile latency stats. Every read benchmark (traversal, lookup,
 * aggregation) goes through this so warm-up policy is identical everywhere,
 * per the assignment's "warm up each database before measuring" rule.
 */
export async function measureReadLatency(op: () => Promise<unknown>): Promise<LatencyStats> {
  for (let i = 0; i < env.BENCH_WARMUP_ITERATIONS; i++) {
    await op();
  }

  const samples: number[] = [];
  for (let i = 0; i < env.BENCH_READ_ITERATIONS; i++) {
    const stop = startTimer();
    await op();
    samples.push(stop());
  }
  return summarize(samples);
}
