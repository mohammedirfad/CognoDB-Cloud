import { createClient, RedisClientType } from "redis";
import { GraphAdapter, NodeRecord, EdgeRecord, Footprint } from "./types";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { childLogger } from "../utils/logger";

const log = childLogger({ adapter: "falkordb" });

/**
 * FalkorDB stores graphs inside a Redis keyspace and answers a Cypher
 * subset via the GRAPH.QUERY command. We use the raw Redis client and issue
 * GRAPH.QUERY manually since it is not a first-class command in node-redis.
 */
export class FalkorDBAdapter implements GraphAdapter {
  readonly id = "falkordb";
  readonly displayName = "FalkorDB Cloud";
  private client!: RedisClientType;
  private readonly graph = env.FALKORDB_GRAPH_NAME;

  async connect(): Promise<void> {
    if (!env.FALKORDB_URL) {
      throw new Error("FalkorDB is not configured: set FALKORDB_URL in .env");
    }
    this.client = createClient({ url: env.FALKORDB_URL });
    this.client.on("error", (err) => log.error({ err: String(err) }, "redis client error"));
    await this.client.connect();
    log.info("connected");
  }

  async disconnect(): Promise<void> {
    await this.client?.quit();
  }

  private async query(cypher: string, params: Record<string, unknown> = {}): Promise<unknown[][]> {
    return withRetry(
      async () => {
        // FalkorDB inlines params as a query prefix: CYPHER a=1 b=2 <query>
        const prefix = Object.entries(params)
          .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
          .join(" ");
        const fullQuery = prefix ? `CYPHER ${prefix} ${cypher}` : cypher;
        const res = (await this.client.sendCommand(["GRAPH.QUERY", this.graph, fullQuery])) as unknown[];
        // GRAPH.QUERY reply shape: [header, rows, stats]. Rows may be absent
        // for write-only queries.
        return (res?.[1] as unknown[][]) ?? [];
      },
      { label: "falkordb:query" },
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async clearDatabase(): Promise<void> {
    try {
      await this.client.sendCommand(["GRAPH.DELETE", this.graph]);
    } catch {
      // Graph did not exist yet - nothing to clear.
    }
  }

  async createIndexes(): Promise<void> {
    await this.query("CREATE INDEX FOR (n:Person) ON (n.id)");
    await this.query("CREATE INDEX FOR (n:Person) ON (n.age)");
  }

  async loadNodes(nodes: NodeRecord[], batchSize: number): Promise<{ count: number }> {
    let count = 0;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize);
      const values = batch.map((n) => `{id:'${n.id}',age:${n.age},region:'${n.region}'}`).join(",");
      await this.query(`UNWIND [${values}] AS row CREATE (n:Person {id: row.id, age: row.age, region: row.region})`);
      count += batch.length;
    }
    return { count };
  }

  async loadEdges(edges: EdgeRecord[], batchSize: number): Promise<{ count: number }> {
    let count = 0;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize);
      const values = batch.map((e) => `{from:'${e.from}',to:'${e.to}'}`).join(",");
      await this.query(
        `UNWIND [${values}] AS row MATCH (a:Person {id: row.from}), (b:Person {id: row.to}) CREATE (a)-[:FOLLOWS]->(b)`,
      );
      count += batch.length;
    }
    return { count };
  }

  async traversal(startId: string, hops: 1 | 2 | 3): Promise<number> {
    const rows = await this.query(
      `MATCH (n:Person {id: '${startId}'})-[:FOLLOWS*1..${hops}]->(m) RETURN count(DISTINCT m)`,
    );
    return Number(rows[0]?.[0] ?? 0);
  }

  async pointLookup(id: string): Promise<boolean> {
    const rows = await this.query(`MATCH (n:Person {id: '${id}'}) RETURN n`);
    return rows.length > 0;
  }

  async indexedLookup(minAge: number, maxAge: number): Promise<number> {
    const rows = await this.query(
      `MATCH (n:Person) WHERE n.age >= ${minAge} AND n.age <= ${maxAge} RETURN count(n)`,
    );
    return Number(rows[0]?.[0] ?? 0);
  }

  async aggregation(): Promise<number> {
    const rows = await this.query("MATCH (n:Person) RETURN n.region, count(*) ORDER BY count(*) DESC");
    return rows.length;
  }

  async mixedRead(id: string): Promise<void> {
    await this.query(`MATCH (n:Person {id: '${id}'}) RETURN n.age`);
  }

  async mixedWrite(edge: EdgeRecord): Promise<void> {
    await this.query(
      `MATCH (a:Person {id: '${edge.from}'}), (b:Person {id: '${edge.to}'}) CREATE (a)-[:FOLLOWS]->(b)`,
    );
  }

  async getFootprint(): Promise<Footprint> {
    try {
      const info = await this.client.sendCommand(["GRAPH.MEMORY", "USAGE", this.graph]);
      return { storedDataMb: "not observable", memoryMb: Number(info) / 1024 / 1024, note: "via GRAPH.MEMORY USAGE" };
    } catch {
      return { storedDataMb: "not observable", memoryMb: "not observable", note: "GRAPH.MEMORY not available on this tier" };
    }
  }
}

export function createFalkorDBAdapter(): FalkorDBAdapter {
  return new FalkorDBAdapter();
}
