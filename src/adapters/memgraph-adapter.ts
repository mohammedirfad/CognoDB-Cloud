import { BoltAdapter } from "./bolt-adapter";
import { env } from "../config/env";

export function createMemgraphAdapter(): BoltAdapter {
  if (!env.MEMGRAPH_URI || !env.MEMGRAPH_PASSWORD) {
    throw new Error("Memgraph is not configured: set MEMGRAPH_URI and MEMGRAPH_PASSWORD in .env");
  }
  return new BoltAdapter({
    id: "memgraph",
    displayName: "Memgraph Cloud",
    uri: env.MEMGRAPH_URI,
    user: env.MEMGRAPH_USER,
    password: env.MEMGRAPH_PASSWORD,
    // Memgraph does not use Neo4j-style multi-database selection.
    database: undefined,
    dialect: "memgraph",
  });
}
