import { BoltAdapter } from "./bolt-adapter";
import { env } from "../config/env";

export function createCognoDBAdapter(): BoltAdapter {
  if (!env.COGNODB_URI || !env.COGNODB_PASSWORD) {
    throw new Error("CognoDB is not configured: set COGNODB_URI and COGNODB_PASSWORD in .env");
  }
  return new BoltAdapter({
    id: "cognodb",
    displayName: "CognoDB Cloud",
    uri: env.COGNODB_URI,
    user: env.COGNODB_USER,
    password: env.COGNODB_PASSWORD,
    database: env.COGNODB_DATABASE,
    dialect: "neo4j",
  });
}
