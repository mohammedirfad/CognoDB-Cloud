import { GraphAdapter, NodeRecord } from "../adapters/types";
import { LatencyStats } from "../utils/stats";
import { measureReadLatency } from "./read-workload";
import { pickRandom } from "../utils/random";

export interface LookupResults {
  pointLookup: LatencyStats;
  indexedLookup: LatencyStats;
}

export async function benchmarkLookup(adapter: GraphAdapter, nodes: NodeRecord[]): Promise<LookupResults> {
  const sampleIds = pickRandom(nodes, 200).map((n) => n.id);
  let cursor = 0;
  const nextId = () => sampleIds[cursor++ % sampleIds.length];

  const pointLookup = await measureReadLatency(() => adapter.pointLookup(nextId()));
  // A 10-year age band is a realistic filtered/indexed range query.
  const indexedLookup = await measureReadLatency(() => {
    const min = 18 + Math.floor(Math.random() * 50);
    return adapter.indexedLookup(min, min + 10);
  });

  return { pointLookup, indexedLookup };
}
