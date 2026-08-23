import { GraphAdapter, NodeRecord } from "../adapters/types";
import { LatencyStats } from "../utils/stats";
import { measureReadLatency } from "./read-workload";
import { pickRandom } from "../utils/random";

export interface TraversalResults {
  hop1: LatencyStats;
  hop2: LatencyStats;
  hop3: LatencyStats;
}

export async function benchmarkTraversal(adapter: GraphAdapter, nodes: NodeRecord[]): Promise<TraversalResults> {
  const startNodes = pickRandom(nodes, 200).map((n) => n.id);
  let cursor = 0;
  const nextId = () => startNodes[cursor++ % startNodes.length];

  const hop1 = await measureReadLatency(() => adapter.traversal(nextId(), 1));
  const hop2 = await measureReadLatency(() => adapter.traversal(nextId(), 2));
  const hop3 = await measureReadLatency(() => adapter.traversal(nextId(), 3));

  return { hop1, hop2, hop3 };
}
