import { env } from "./env";

export type PlatformId = "cognodb" | "neo4j" | "memgraph" | "arangodb" | "falkordb";

export interface PlatformDescriptor {
  id: PlatformId;
  displayName: string;
  protocol: "bolt" | "aql" | "redis-graph";
  instanceSpec: string;
  /** True only when the required connection env vars are present. */
  enabled: boolean;
}

function has(...values: (string | undefined)[]): boolean {
  return values.every((v) => v !== undefined && v.length > 0);
}

export const PLATFORMS: PlatformDescriptor[] = [
  {
    id: "cognodb",
    displayName: "CognoDB Cloud",
    protocol: "bolt",
    instanceSpec: env.COGNODB_INSTANCE_SPEC,
    enabled: has(env.COGNODB_URI, env.COGNODB_PASSWORD),
  },
  {
    id: "neo4j",
    displayName: "Neo4j AuraDB Free",
    protocol: "bolt",
    instanceSpec: env.NEO4J_INSTANCE_SPEC,
    enabled: has(env.NEO4J_URI, env.NEO4J_PASSWORD),
  },
  {
    id: "memgraph",
    displayName: "Memgraph Cloud",
    protocol: "bolt",
    instanceSpec: env.MEMGRAPH_INSTANCE_SPEC,
    enabled: has(env.MEMGRAPH_URI, env.MEMGRAPH_PASSWORD),
  },
  {
    id: "arangodb",
    displayName: "ArangoDB Oasis",
    protocol: "aql",
    instanceSpec: env.ARANGODB_INSTANCE_SPEC,
    enabled: has(env.ARANGODB_URL, env.ARANGODB_PASSWORD),
  },
  {
    id: "falkordb",
    displayName: "FalkorDB Cloud",
    protocol: "redis-graph",
    instanceSpec: env.FALKORDB_INSTANCE_SPEC,
    enabled: has(env.FALKORDB_URL),
  },
];

export function enabledPlatforms(): PlatformDescriptor[] {
  return PLATFORMS.filter((p) => p.enabled);
}
