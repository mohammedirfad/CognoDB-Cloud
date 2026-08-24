import { Database } from "arangojs";
import { GraphAdapter, NodeRecord, EdgeRecord, Footprint } from "./types";
import { env } from "../config/env";
import { withRetry } from "../utils/retry";
import { childLogger } from "../utils/logger";

const log = childLogger({ adapter: "arangodb" });

/**
 * ArangoDB is multi-model: graphs are expressed as a document collection
 * (nodes) plus an edge collection, queried with AQL instead of Cypher.
 * Logically it runs the same traversal/lookup/aggregation operations as the
 * Bolt platforms - only the query language differs.
 */
export class ArangoDBAdapter implements GraphAdapter {
  readonly id = "arangodb";
  readonly displayName = "ArangoDB Oasis";
  private db!: Database;

  async connect(): Promise<void> {
    if (!env.ARANGODB_URL || !env.ARANGODB_PASSWORD) {
      throw new Error("ArangoDB is not configured: set ARANGODB_URL and ARANGODB_PASSWORD in .env");
    }
    const system = new Database({ url: env.ARANGODB_URL, auth: { username: env.ARANGODB_USER, password: env.ARANGODB_PASSWORD } });
    const dbName = env.ARANGODB_DATABASE;
    const exists = (await system.listDatabases()).includes(dbName);
    if (!exists) await system.createDatabase(dbName);
    this.db = system.database(dbName);

    if (!(await this.db.collection("Person").exists())) await this.db.createCollection("Person");
    if (!(await this.db.collection("Follows").exists())) await this.db.createEdgeCollection("Follows");
    log.info("connected");
  }

  async disconnect(): Promise<void> {
    // arangojs has no persistent socket to close explicitly.
  }

  private async query<T = unknown>(aql: string, bindVars: Record<string, unknown> = {}): Promise<T[]> {
    return withRetry(
      async () => {
        const cursor = await this.db.query({ query: aql, bindVars });
        return cursor.all();
      },
      { label: "arangodb:query" },
    );
  }

  async ping(): Promise<boolean> {
    try {
      await this.query("RETURN 1");
      return true;
    } catch {
      return false;
    }
  }

  async clearDatabase(): Promise<void> {
    await this.query("FOR e IN Follows REMOVE e IN Follows");
    await this.query("FOR n IN Person REMOVE n IN Person");
  }

  async createIndexes(): Promise<void> {
    const persons = this.db.collection("Person");
    await persons.ensureIndex({ type: "persistent", fields: ["nodeId"], unique: true, name: "person_id" });
    await persons.ensureIndex({ type: "persistent", fields: ["age"], name: "person_age" });
  }

  async loadNodes(nodes: NodeRecord[], batchSize: number): Promise<{ count: number }> {
    const col = this.db.collection("Person");
    let count = 0;
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = nodes.slice(i, i + batchSize).map((n) => ({ _key: n.id, nodeId: n.id, age: n.age, region: n.region }));
      await withRetry(() => col.saveAll(batch), { label: "arangodb:loadNodes" });
      count += batch.length;
    }
    return { count };
  }

  async loadEdges(edges: EdgeRecord[], batchSize: number): Promise<{ count: number }> {
    const col = this.db.collection("Follows");
    let count = 0;
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = edges.slice(i, i + batchSize).map((e) => ({ _from: `Person/${e.from}`, _to: `Person/${e.to}` }));
      await withRetry(() => col.saveAll(batch), { label: "arangodb:loadEdges" });
      count += batch.length;
    }
    return { count };
  }

  async traversal(startId: string, hops: 1 | 2 | 3): Promise<number> {
    const res = await this.query<number>(
      `WITH Person
       FOR v IN 1..@hops OUTBOUND CONCAT('Person/', @id) Follows
         RETURN DISTINCT v._key`,
      { id: startId, hops },
    );
    return res.length;
  }

  async pointLookup(id: string): Promise<boolean> {
    const res = await this.query<unknown>("FOR n IN Person FILTER n.nodeId == @id RETURN n", { id });
    return res.length > 0;
  }

  async indexedLookup(minAge: number, maxAge: number): Promise<number> {
    const res = await this.query<number>(
      "FOR n IN Person FILTER n.age >= @minAge AND n.age <= @maxAge COLLECT WITH COUNT INTO c RETURN c",
      { minAge, maxAge },
    );
    return res[0] ?? 0;
  }

  async aggregation(): Promise<number> {
    const res = await this.query<{ region: string; c: number }>(
      "FOR n IN Person COLLECT region = n.region WITH COUNT INTO c RETURN {region, c}",
    );
    return res.length;
  }

  async mixedRead(id: string): Promise<void> {
    await this.query("FOR n IN Person FILTER n.nodeId == @id RETURN n.age", { id });
  }

  async mixedWrite(edge: EdgeRecord): Promise<void> {
    await this.query("INSERT { _from: CONCAT('Person/', @from), _to: CONCAT('Person/', @to) } INTO Follows", { ...edge });
  }

  async getFootprint(): Promise<Footprint> {
    try {
      const info = await this.db.collection("Person").figures();
      const bytes = (info as unknown as { figures?: { documentsSize?: number } }).figures?.documentsSize;
      if (typeof bytes === "number") {
        return { storedDataMb: Math.round((bytes / 1024 / 1024) * 100) / 100, memoryMb: "not observable", note: "via collection.figures()" };
      }
    } catch {
      // Oasis may restrict the figures() admin endpoint on free tiers.
    }
    return { storedDataMb: "not observable", memoryMb: "not observable", note: "figures() endpoint restricted on this tier" };
  }
}

export function createArangoDBAdapter(): ArangoDBAdapter {
  return new ArangoDBAdapter();
}
