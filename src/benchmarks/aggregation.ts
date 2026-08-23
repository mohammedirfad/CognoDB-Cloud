import { GraphAdapter } from "../adapters/types";
import { LatencyStats } from "../utils/stats";
import { measureReadLatency } from "./read-workload";

export async function benchmarkAggregation(adapter: GraphAdapter): Promise<LatencyStats> {
  // Aggregations are typically far fewer iterations than point reads since
  // they scan/group over the whole label - the env default keeps this
  // proportionate but callers can still override BENCH_READ_ITERATIONS.
  return measureReadLatency(() => adapter.aggregation());
}
