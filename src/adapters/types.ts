export interface NodeRecord {
  id: string;
  label: string;
  age: number;
  region: string;
}

export interface EdgeRecord {
  from: string;
  to: string;
  type: string;
}

export interface Footprint {
  storedDataMb: number | "not observable";
  memoryMb: number | "not observable";
  note: string;
}

export interface IngestResult {
  nodesLoaded: number;
  edgesLoaded: number;
  wallClockMs: number;
  nodesPerSecond: number;
  edgesPerSecond: number;
}

/**
 * Every platform under test implements this contract. Keeping the surface
 * identical is what makes the benchmark fair: every platform runs the exact
 * same logical operation, just expressed in its own query language.
 */
export interface GraphAdapter {
  readonly id: string;
  readonly displayName: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<boolean>;

  /** Wipes prior benchmark data so runs are repeatable. */
  clearDatabase(): Promise<void>;
  /** Creates an index on Node(id) and Node(age) - documented per platform in README. */
  createIndexes(): Promise<void>;

  loadNodes(nodes: NodeRecord[], batchSize: number): Promise<{ count: number }>;
  loadEdges(edges: EdgeRecord[], batchSize: number): Promise<{ count: number }>;

  /** MATCH (n {id})-[*1..hops]->(m) RETURN count(distinct m) - same semantics everywhere. */
  traversal(startId: string, hops: 1 | 2 | 3): Promise<number>;
  /** Exact-match lookup by primary id (indexed everywhere). */
  pointLookup(id: string): Promise<boolean>;
  /** Range/filter lookup on a secondary indexed property (age). */
  indexedLookup(minAge: number, maxAge: number): Promise<number>;
  /** count(*) grouped by region. */
  aggregation(): Promise<number>;

  /** Single random read for the mixed workload. */
  mixedRead(id: string): Promise<void>;
  /** Single write (new edge) for the mixed workload. */
  mixedWrite(edge: EdgeRecord): Promise<void>;

  getFootprint(): Promise<Footprint>;
}
