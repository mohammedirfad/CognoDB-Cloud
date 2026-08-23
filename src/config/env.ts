import "dotenv/config";
import { z } from "zod";

/**
 * Every environment variable the project reads is declared and validated
 * here. Fail fast, at process start, with a readable error rather than a
 * confusing runtime crash three benchmarks in.
 */
const envSchema = z.object({
  // Dataset
  DATASET_SOURCE: z.enum(["pokec", "synthetic"]).default("synthetic"),
  DATASET_TARGET_RELATIONSHIPS: z.coerce.number().int().positive().default(150_000),
  DATASET_SEED: z.coerce.number().int().default(42),

  // Benchmark parameters
  BENCH_READ_ITERATIONS: z.coerce.number().int().positive().default(120),
  BENCH_WARMUP_ITERATIONS: z.coerce.number().int().nonnegative().default(20),
  BENCH_MIXED_DURATION_SECONDS: z.coerce.number().int().positive().default(30),
  BENCH_MIXED_CONCURRENCY_LEVELS: z
    .string()
    .default("1,10,40")
    .transform((v) => v.split(",").map((n) => parseInt(n.trim(), 10))),
  BENCH_MIXED_READ_WRITE_RATIO: z.coerce.number().min(0).max(1).default(0.8),
  BENCH_BATCH_SIZE: z.coerce.number().int().positive().default(1000),
  BENCH_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  BENCH_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().default(250),

  // CognoDB
  COGNODB_URI: z.string().optional(),
  COGNODB_USER: z.string().default("cognodb"),
  COGNODB_PASSWORD: z.string().optional(),
  COGNODB_DATABASE: z.string().default("neo4j"),
  COGNODB_INSTANCE_SPEC: z.string().default("unspecified"),

  // Neo4j AuraDB
  NEO4J_URI: z.string().optional(),
  NEO4J_USER: z.string().default("neo4j"),
  NEO4J_PASSWORD: z.string().optional(),
  NEO4J_DATABASE: z.string().default("neo4j"),
  NEO4J_INSTANCE_SPEC: z.string().default("unspecified"),

  // Memgraph
  MEMGRAPH_URI: z.string().optional(),
  MEMGRAPH_USER: z.string().default("memgraph"),
  MEMGRAPH_PASSWORD: z.string().optional(),
  MEMGRAPH_INSTANCE_SPEC: z.string().default("unspecified"),

  // ArangoDB
  ARANGODB_URL: z.string().optional(),
  ARANGODB_USER: z.string().default("root"),
  ARANGODB_PASSWORD: z.string().optional(),
  ARANGODB_DATABASE: z.string().default("benchmark"),
  ARANGODB_INSTANCE_SPEC: z.string().default("unspecified"),

  // FalkorDB
  FALKORDB_URL: z.string().optional(),
  FALKORDB_GRAPH_NAME: z.string().default("benchmark"),
  FALKORDB_INSTANCE_SPEC: z.string().default("unspecified"),

  // API server
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((v) => v.split(",").map((s) => s.trim())),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(60),
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  API_KEY: z.string().default("change-me-local-dev-only"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    // eslint-disable-next-line no-console
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
