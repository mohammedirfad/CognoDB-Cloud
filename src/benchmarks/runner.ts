import fs from "node:fs";
import path from "node:path";
import { GraphAdapter, IngestResult, Footprint } from "../adapters/types";
import { buildEnabledAdapters } from "../adapters";
import { loadPreparedDataset } from "../dataset/loader";
import { benchmarkIngest } from "./ingest";
import { benchmarkTraversal, TraversalResults } from "./traversal";
import { benchmarkLookup, LookupResults } from "./lookup";
import { benchmarkAggregation } from "./aggregation";
import { benchmarkMixedWorkload, MixedWorkloadPoint } from "./mixed-workload";
import { LatencyStats } from "../utils/stats";
import { PLATFORMS } from "../config/platforms";
import { childLogger } from "../utils/logger";

export interface PlatformResult {
  platformId: string;
  displayName: string;
  instanceSpec: string;
  ingest: IngestResult;
  traversal: TraversalResults;
  lookup: LookupResults;
  aggregation: LatencyStats;
  mixedWorkload: MixedWorkloadPoint[];
  footprint: Footprint;
  error?: string;
}

export interface RunManifest {
  runAt: string;
  dataset: { nodeCount: number; edgeCount: number };
  platforms: PlatformResult[];
  skipped: { platformId: string; reason: string }[];
}

const log = childLogger({ phase: "runner" });

export async function runAllBenchmarks(): Promise<RunManifest> {
  const { nodes, edges } = loadPreparedDataset();
  const adapters = buildEnabledAdapters();

  const skipped = PLATFORMS.filter((p) => !p.enabled).map((p) => ({
    platformId: p.id,
    reason: "missing connection env vars - see .env.example",
  }));
  for (const s of skipped) log.warn(s, "skipping platform");

  const platforms: PlatformResult[] = [];

  for (const adapter of adapters) {
    platforms.push(await runOnePlatform(adapter, nodes, edges));
  }

  const manifest: RunManifest = {
    runAt: new Date().toISOString(),
    dataset: { nodeCount: nodes.length, edgeCount: edges.length },
    platforms,
    skipped,
  };

  const resultsDir = path.join(process.cwd(), "results");
  fs.mkdirSync(resultsDir, { recursive: true });
  const file = path.join(resultsDir, `run-${manifest.runAt.replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(resultsDir, "latest.json"), JSON.stringify(manifest, null, 2));
  log.info({ file }, "results written");

  return manifest;
}

async function runOnePlatform(
  adapter: GraphAdapter,
  nodes: ReturnType<typeof loadPreparedDataset>["nodes"],
  edges: ReturnType<typeof loadPreparedDataset>["edges"],
): Promise<PlatformResult> {
  const platformMeta = PLATFORMS.find((p) => p.id === adapter.id)!;
  const plog = childLogger({ adapter: adapter.id });

  try {
    plog.info("connecting");
    await adapter.connect();

    const ingest = await benchmarkIngest(adapter, nodes, edges);
    const traversal = await benchmarkTraversal(adapter, nodes);
    const lookup = await benchmarkLookup(adapter, nodes);
    const aggregation = await benchmarkAggregation(adapter);
    const mixedWorkload = await benchmarkMixedWorkload(adapter, nodes);
    const footprint = await adapter.getFootprint();

    await adapter.disconnect();

    return {
      platformId: adapter.id,
      displayName: adapter.displayName,
      instanceSpec: platformMeta.instanceSpec,
      ingest,
      traversal,
      lookup,
      aggregation,
      mixedWorkload,
      footprint,
    };
  } catch (err) {
    plog.error({ err: String(err) }, "platform benchmark failed - recording as a caveat, not aborting the whole run");
    return {
      platformId: adapter.id,
      displayName: adapter.displayName,
      instanceSpec: platformMeta.instanceSpec,
      ingest: { nodesLoaded: 0, edgesLoaded: 0, wallClockMs: 0, nodesPerSecond: 0, edgesPerSecond: 0 },
      traversal: { hop1: emptyStats(), hop2: emptyStats(), hop3: emptyStats() },
      lookup: { pointLookup: emptyStats(), indexedLookup: emptyStats() },
      aggregation: emptyStats(),
      mixedWorkload: [],
      footprint: { storedDataMb: "not observable", memoryMb: "not observable", note: "run failed" },
      error: String(err),
    };
  }
}

function emptyStats(): LatencyStats {
  return { count: 0, meanMs: 0, minMs: 0, maxMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, stdDevMs: 0 };
}
