import { BoltAdapter } from "./bolt-adapter";
import { env } from "../config/env";

export function createNeo4jAdapter(): BoltAdapter {
  if (!env.NEO4J_URI || !env.NEO4J_PASSWORD) {
    throw new Error("Neo4j AuraDB is not configured: set NEO4J_URI and NEO4J_PASSWORD in .env");
  }
  return new BoltAdapter({
    id: "neo4j",
    displayName: "Neo4j AuraDB Free",
    uri: env.NEO4J_URI,
    user: env.NEO4J_USER,
    password: env.NEO4J_PASSWORD,
    database: env.NEO4J_DATABASE,
    dialect: "neo4j",
  });
}
