import neo4j, { Driver, Session } from "neo4j-driver";
import { GraphAdapter, NodeRecord, EdgeRecord, Footprint } from "./types";
import { withRetry } from "../utils/retry";
import { childLogger } from "../utils/logger";

export interface BoltConfig {
  id: string;
  displayName: string;
  uri: string;
  user: string;
  password: string;
  database?: string;
  /**
   * "neo4j" and "cognodb" (which is Neo4j-protocol-compatible) accept the
   * modern `CREATE INDEX ... IF NOT EXISTS FOR (n:Label) ON (n.prop)`
   * syntax. Memgraph's Cypher dialect uses the older
   * `CREATE INDEX ON :Label(prop)` form and has no APOC. This flag is the
   * one deliberate, documented divergence so each platform gets a valid
   * index instead of a silently-failing query.
   */
  dialect?: "neo4j" | "memgraph";
}

/**
 * Base class for every database that speaks the Bolt protocol with Cypher
 * (CognoDB, Neo4j AuraDB, Memgraph). Sharing this class guarantees the three
 * platforms run byte-identical queries - the only difference is the driver
 * connection target, which is exactly what we want to isolate.
 */
export class BoltAdapter implements GraphAdapter {
  readonly id: string;
  readonly displayName: string;
  private driver: Driver | null = null;
  private readonly log;

  constructor(private readonly config: BoltConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.log = childLogger({ adapter: this.id });
  }

  async connect(): Promise<void> {
    this.driver = neo4j.driver(this.config.uri, neo4j.auth.basic(this.config.user, this.config.password), {
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 15_000,
    });
    await this.driver.verifyConnectivity();
    this.log.info("connected");
  }

  async disconnect(): Promise<void> {
    await this.driver?.close();
  }

  private session(): Session {
    if (!this.driver) throw new Error(`${this.id}: driver not connected`);
    return this.driver.session({ database: this.config.database });
  }

  private async run<T = unknown>(query: string, params: Record<string, unknown> = {}): Promise<T[]> {
    return withRetry(
      async () => {
        const session = this.session();
        try {
          const result = await session.run(query, params);
          return result.records.map((r) => r.toObject() as T);
        } finally {
          await session.close();
        }
      },
      { label: `${this.id}:query` },
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.run("RETURN 1");
      return true;
    } catch {
      return false;
    }
  }

  async clearDatabase(): Promise<void> {
    // Batched delete avoids blowing the free-tier memory budget on a single
    // giant transaction when the dataset is large.
    let deleted = 1;
    while (deleted > 0) {
      const res = await this.run<{ deleted: number }>(
        "MATCH (n) WITH n LIMIT 20000 DETACH DELETE n RETURN count(n) AS deleted",
      );
      deleted = res[0]?.deleted ?? 0;
    }
  }

  async createIndexes(): Promise<void> {
    if (this.config.dialect === "memgraph") {
      await this.run("CREATE INDEX ON :Person(id)");
      await this.run("CREATE INDEX ON :Person(age)");
      return;
    }
    await this.run("CREATE INDEX person_id IF NOT EXISTS FOR (n:Person) ON (n.id)");
    await this.run("CREATE INDEX person_age IF NOT EXISTS FOR (n:Person) ON (n.age)");
  }

  async loadNodes(nodes: NodeRecord[], batchSize: number): Promise<{ count: number }> {
    let count = 0;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      await this.run(
        `UNWIND $batch AS row
         CREATE (n:Person {id: row.id, age: row.age, region: row.region})`,
        { batch },
      );
      count += batch.length;
    }
    return { count };
  }

  async loadEdges(edges: EdgeRecord[], batchSize: number): Promise<{ count: number }> {
    let count = 0;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      await this.run(
        `UNWIND $batch AS row
         MATCH (a:Person {id: row.from}), (b:Person {id: row.to})
         CREATE (a)-[:FOLLOWS]->(b)`,
        { batch },
      );
      count += batch.length;
    }
    return { count };
  }

  async traversal(startId: string, hops: 1 | 2 | 3): Promise<number> {
    const res = await this.run<{ c: number }>(
      `MATCH (n:Person {id: $id})-[:FOLLOWS*1..${hops}]->(m)
       RETURN count(DISTINCT m) AS c`,
      { id: startId },
    );
    return Number(res[0]?.c ?? 0);
  }

  async pointLookup(id: string): Promise<boolean> {
    const res = await this.run<{ n: unknown }>("MATCH (n:Person {id: $id}) RETURN n", { id });
    return res.length > 0;
  }

  async indexedLookup(minAge: number, maxAge: number): Promise<number> {
    const res = await this.run<{ c: number }>(
      "MATCH (n:Person) WHERE n.age >= $minAge AND n.age <= $maxAge RETURN count(n) AS c",
      { minAge, maxAge },
    );
    return Number(res[0]?.c ?? 0);
  }

  async aggregation(): Promise<number> {
    const res = await this.run<{ region: string; c: number }>(
      "MATCH (n:Person) RETURN n.region AS region, count(*) AS c ORDER BY c DESC",
    );
    return res.length;
  }

  async mixedRead(id: string): Promise<void> {
    await this.run("MATCH (n:Person {id: $id}) RETURN n.age AS age", { id });
  }

  async mixedWrite(edge: EdgeRecord): Promise<void> {
    await this.run(
      `MATCH (a:Person {id: $from}), (b:Person {id: $to})
       CREATE (a)-[:FOLLOWS {createdAt: timestamp()}]->(b)`,
      { ...edge },
    );
  }

  async getFootprint(): Promise<Footprint> {
    if (this.config.dialect === "memgraph") {
      try {
        const res = await this.run<{ storage_info: string; value: number }>("SHOW STORAGE INFO");
        const memRow = res.find((r) => String(r.storage_info).toLowerCase().includes("memory"));
        if (memRow) {
          return { storedDataMb: "not observable", memoryMb: Number(memRow.value) / 1024 / 1024, note: "via SHOW STORAGE INFO" };
        }
      } catch {
        // fall through
      }
      return { storedDataMb: "not observable", memoryMb: "not observable", note: "SHOW STORAGE INFO unavailable on this tier" };
    }
    try {
      const res = await this.run<{ store: number }>(
        "CALL apoc.monitor.store() YIELD stringStoreSize, nodeStoreSize, relStoreSize, propStoreSize " +
          "RETURN (stringStoreSize + nodeStoreSize + relStoreSize + propStoreSize) AS store",
      );
      const bytes = res[0]?.store;
      if (typeof bytes === "number") {
        return { storedDataMb: Math.round((bytes / 1024 / 1024) * 100) / 100, memoryMb: "not observable", note: "via apoc.monitor.store" };
      }
    } catch {
      // APOC not installed on this platform/tier - fall through.
    }
    return {
      storedDataMb: "not observable",
      memoryMb: "not observable",
      note: "Platform does not expose storage/memory metrics on this tier without APOC or an admin API.",
    };
  }
}
