import { GraphAdapter, NodeRecord, EdgeRecord, IngestResult } from "../adapters/types";
import { env } from "../config/env";
import { childLogger } from "../utils/logger";

export async function benchmarkIngest(adapter: GraphAdapter, nodes: NodeRecord[], edges: EdgeRecord[]): Promise<IngestResult> {
  const log = childLogger({ adapter: adapter.id, phase: "ingest" });

  await adapter.clearDatabase();
  await adapter.createIndexes();

  const start = process.hrtime.bigint();
  const { count: nodesLoaded } = await adapter.loadNodes(nodes, env.BENCH_BATCH_SIZE);
  const { count: edgesLoaded } = await adapter.loadEdges(edges, env.BENCH_BATCH_SIZE);
  const wallClockMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  const result: IngestResult = {
    nodesLoaded,
    edgesLoaded,
    wallClockMs: round2(wallClockMs),
    nodesPerSecond: round2(nodesLoaded / (wallClockMs / 1000)),
    edgesPerSecond: round2(edgesLoaded / (wallClockMs / 1000)),
  };
  log.info(result, "ingest complete");
  return result;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
