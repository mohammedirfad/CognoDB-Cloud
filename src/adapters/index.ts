import { GraphAdapter } from "./types";
import { createCognoDBAdapter } from "./cognodb-adapter";
import { createNeo4jAdapter } from "./neo4j-adapter";
import { createMemgraphAdapter } from "./memgraph-adapter";
import { createArangoDBAdapter } from "./arangodb-adapter";
import { createFalkorDBAdapter } from "./falkordb-adapter";
import { enabledPlatforms, PlatformId } from "../config/platforms";

const factories: Record<PlatformId, () => GraphAdapter> = {
  cognodb: createCognoDBAdapter,
  neo4j: createNeo4jAdapter,
  memgraph: createMemgraphAdapter,
  arangodb: createArangoDBAdapter,
  falkordb: createFalkorDBAdapter,
};

export function buildEnabledAdapters(): GraphAdapter[] {
  return enabledPlatforms().map((p) => factories[p.id]());
}

export * from "./types";
