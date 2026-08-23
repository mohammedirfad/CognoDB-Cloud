import pLimit from "p-limit";
import { GraphAdapter, NodeRecord } from "../adapters/types";
import { env } from "../config/env";
import { pickRandom } from "../utils/random";
import { childLogger } from "../utils/logger";

export interface MixedWorkloadPoint {
  concurrency: number;
  durationSeconds: number;
  totalOps: number;
  readOps: number;
  writeOps: number;
  throughputQps: number;
  errors: number;
}

const log = childLogger({ phase: "mixed-workload" });

/**
 * Sustained read/write throughput under a fixed client concurrency, swept
 * across BENCH_MIXED_CONCURRENCY_LEVELS (default 1/10/40). Each "client" is
 * a logical worker continuously issuing requests through a p-limit gate for
 * the configured duration - not a fixed op count - so the result is a true
 * queries/second figure comparable across platforms with different
 * per-query latency.
 */
export async function benchmarkMixedWorkload(adapter: GraphAdapter, nodes: NodeRecord[]): Promise<MixedWorkloadPoint[]> {
  const sampleIds = pickRandom(nodes, 500).map((n) => n.id);
  const results: MixedWorkloadPoint[] = [];

  for (const concurrency of env.BENCH_MIXED_CONCURRENCY_LEVELS) {
    const limit = pLimit(concurrency);
    const durationMs = env.BENCH_MIXED_DURATION_SECONDS * 1000;
    const deadline = Date.now() + durationMs;

    let readOps = 0;
    let writeOps = 0;
    let errors = 0;

    const worker = async () => {
      while (Date.now() < deadline) {
        const isRead = Math.random() < env.BENCH_MIXED_READ_WRITE_RATIO;
        try {
          if (isRead) {
            const id = sampleIds[Math.floor(Math.random() * sampleIds.length)];
            await adapter.mixedRead(id);
            readOps++;
          } else {
            const from = sampleIds[Math.floor(Math.random() * sampleIds.length)];
            const to = sampleIds[Math.floor(Math.random() * sampleIds.length)];
            await adapter.mixedWrite({ from, to, type: "FOLLOWS" });
            writeOps++;
          }
        } catch (err) {
          errors++;
          log.warn({ err: String(err), adapter: adapter.id }, "mixed workload op failed");
        }
      }
    };

    const start = Date.now();
    await Promise.all(Array.from({ length: concurrency }, () => limit(worker)));
    const actualDurationSeconds = (Date.now() - start) / 1000;

    const totalOps = readOps + writeOps;
    results.push({
      concurrency,
      durationSeconds: Math.round(actualDurationSeconds * 100) / 100,
      totalOps,
      readOps,
      writeOps,
      throughputQps: Math.round((totalOps / actualDurationSeconds) * 100) / 100,
      errors,
    });
  }

  return results;
}
