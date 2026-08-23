# CognoDB Cloud Benchmarks

A reproducible benchmark suite comparing **[CognoDB Cloud](https://console.cognodb.com)** against four other managed graph database platforms on identical hardware tiers, identical datasets, and identical logical queries.



| # | Platform | Protocol | Why it's in this comparison |
|---|---|---|---|
| 1 | **CognoDB Cloud** | Bolt / Cypher | The system under test |
| 2 | **Neo4j AuraDB Free** | Bolt / Cypher | CognoDB speaks the Bolt protocol and Cypher — Neo4j is the reference implementation of both, making it the most direct apples-to-apples comparison |
| 3 | **Memgraph Cloud** | Bolt / Cypher | Also Bolt/Cypher-compatible but an in-memory engine, so it stress-tests whether CognoDB's disk-backed model gives up latency for durability |
| 4 | **ArangoDB Oasis** | AQL (multi-model) | A credible non-Cypher graph engine, to check the comparison isn't just "which Cypher implementation is fastest" |
| 5 | **FalkorDB Cloud** | Redis + `GRAPH.QUERY` (Cypher subset) | A sparse-matrix-backed engine on a completely different storage substrate (Redis), representing the opposite architectural extreme from CognoDB |

Because CognoDB, Neo4j, and Memgraph all speak Bolt, this repo implements them as one shared `BoltAdapter` class (see [`src/adapters/bolt-adapter.ts`](src/adapters/bolt-adapter.ts)) — the three platforms run **byte-identical queries**, differing only in connection target and the one documented dialect divergence (Memgraph's older `CREATE INDEX` syntax, no APOC). ArangoDB and FalkorDB each get their own adapter since AQL and the Redis Cypher subset aren't Bolt-compatible, but every adapter implements the same [`GraphAdapter`](src/adapters/types.ts) interface, so every benchmark function calls the exact same six operations on every platform.

---

## 1. Fairness & methodology

- **Same resources everywhere.** Every platform is run on its free/entry tier, sized to roughly CognoDB's free `c0` instance (burstable 0.5 vCPU, 256 MB RAM, 1 GB disk). Each platform's advertised spec is recorded in `.env` (`*_INSTANCE_SPEC`) and echoed into every results table — see [§5 Results](#5-results-template).
- **Same dataset everywhere.** One dataset is generated once (`npm run dataset:prepare`) and loaded into all five platforms via each platform's native batched driver call (Bolt `UNWIND`/`CREATE`, AQL `saveAll`, `GRAPH.QUERY UNWIND`). No platform gets a bulk-import shortcut another doesn't.
- **Same queries everywhere.** Every adapter implements identical logical operations (1/2/3-hop traversal, point lookup, indexed range lookup, group-by aggregation, mixed read/write) — see the interface in [`src/adapters/types.ts`](src/adapters/types.ts).
- **Warm-up before measuring.** Every read benchmark runs `BENCH_WARMUP_ITERATIONS` (default 20) untimed calls before recording `BENCH_READ_ITERATIONS` (default 120) timed samples — see [`src/benchmarks/read-workload.ts`](src/benchmarks/read-workload.ts). Cold-start latency is not mixed into the warm numbers.
- **Percentiles, not averages.** p50/p95/p99 are computed with a plain nearest-rank calculation ([`src/utils/stats.ts`](src/utils/stats.ts), unit-tested in [`tests/stats.test.ts`](tests/stats.test.ts)).
- **Automated end-to-end.** `scripts/run-all.sh` (or `npm run bench:all`) prepares the dataset, loads every platform, runs every workload, and writes `results/RESULTS.md` — no manual steps between "clone" and "results table."
- **A single run never aborts the whole suite.** If one platform's connection fails or times out, [`src/benchmarks/runner.ts`](src/benchmarks/runner.ts) records the error against that platform and continues with the rest — a flaky free-tier instance doesn't cost you the other four platforms' results.

### Known, deliberate divergences (documented, not hidden)
- **Memgraph index syntax.** Memgraph's Cypher dialect predates Neo4j's `CREATE INDEX ... IF NOT EXISTS FOR (n:Label) ON (n.prop)` syntax and uses `CREATE INDEX ON :Label(prop)` instead; the adapter switches on a `dialect` flag rather than silently failing the index creation.
- **Footprint metric availability differs per platform.** Storage/memory introspection depends on what each managed tier exposes (CognoDB/Neo4j via APOC if installed, Memgraph via `SHOW STORAGE INFO`, ArangoDB via `collection.figures()`, FalkorDB via `GRAPH.MEMORY USAGE`). Where a tier restricts the admin endpoint, the report says `"not observable"` rather than guessing — see §5.2's footprint requirement.
- **Query-string interpolation on FalkorDB.** `node-redis` has no first-class `GRAPH.QUERY` command, so the adapter sends it via `sendCommand` with parameters passed through FalkorDB's `CYPHER k=v ...` prefix syntax rather than driver-level bound parameters. IDs in this benchmark are machine-generated (`p0`, `p1`, ...), never user input, so this is safe here — it would need proper escaping before reuse against untrusted input.

---

## 2. Dataset

Configured via `DATASET_SOURCE` in `.env`:

- **`synthetic` (default).** A seeded preferential-attachment (Barabási–Albert-style) generator in [`src/dataset/prepare.ts`](src/dataset/prepare.ts) produces a scale-free social graph with realistic degree distribution — no internet access required, fully reproducible via `DATASET_SEED`. Suitable for CI and for reviewers without SNAP access.
- **`pokec`.** Downloads and streams a slice of the real [SNAP `soc-Pokec-relationships`](https://snap.stanford.edu/data/soc-Pokec.html) social network edge list named in the assignment (`npm run dataset:download`), then samples it down to `DATASET_TARGET_RELATIONSHIPS`.

Either way, `DATASET_TARGET_RELATIONSHIPS` (default 150,000) keeps the graph inside the 100k–500k relationship range the assignment asks for, and small enough to fit every platform's free tier. `npm run dataset:prepare` writes `data/processed/{nodes.csv,edges.csv,manifest.json}` — the manifest records the exact node/edge counts used in that run.

---

## 3. Setup

### Prerequisites
- Node.js ≥ 18.17
- Free-tier accounts on whichever platforms you want to include (all optional — the suite benchmarks whatever is configured and skips the rest with a logged reason)

### Install

```bash
git clone <this-repo-url>
cd cognodb-benchmark
npm install
cp .env.example .env
```

### Configure platforms

Fill in `.env` for each platform you want to benchmark. **Every platform is optional** — `enabledPlatforms()` ([`src/config/platforms.ts`](src/config/platforms.ts)) only includes a platform once its required env vars are non-empty, so you can run the suite with just CognoDB configured and it will simply report the rest as skipped.

| Platform | Required env vars | Where to get them |
|---|---|---|
| CognoDB Cloud | `COGNODB_URI`, `COGNODB_PASSWORD` | [console.cognodb.com/signup](https://console.cognodb.com/signup) → create free `c0` instance |
| Neo4j AuraDB | `NEO4J_URI`, `NEO4J_PASSWORD` | [console.neo4j.io](https://console.neo4j.io) → create Free instance |
| Memgraph Cloud | `MEMGRAPH_URI`, `MEMGRAPH_PASSWORD` | [memgraph.com/cloud](https://memgraph.com/cloud) → free project |
| ArangoDB Oasis | `ARANGODB_URL`, `ARANGODB_PASSWORD` | [dashboard.arangodb.cloud](https://dashboard.arangodb.cloud) → free trial deployment |
| FalkorDB Cloud | `FALKORDB_URL` | [app.falkordb.cloud](https://app.falkordb.cloud) → free instance connection string |

**Never commit `.env`** — it's in `.gitignore`. All credentials are read exclusively from environment variables (validated at startup by [`src/config/env.ts`](src/config/env.ts) with zod — the process fails fast with a readable error if something required is missing or malformed, rather than failing confusingly mid-benchmark).

---

## 4. Running

```bash
# One command, start to finish: prepare data → load everywhere → run every
# workload → write results/RESULTS.md
npm run bench:all
# or: bash scripts/run-all.sh

# Individual steps, if you want more control:
npm run dataset:download   # only needed if DATASET_SOURCE=pokec
npm run dataset:prepare    # generates data/processed/{nodes,edges}.csv
npm run bench:load         # loads the dataset into every configured platform
npm run bench:run          # runs ingest + traversal + lookup + aggregation + mixed workload, writes results/latest.json
npm run bench:report       # regenerates results/RESULTS.md from results/latest.json

# Optional dashboard/monitoring API (serves results/latest.json over HTTP,
# and can trigger a new run behind an API key):
npm run api:dev            # ts-node dev server with watch, http://localhost:4000
npm run build && npm run api:start   # compiled production server

# Quality gates
npm run typecheck
npm test
npm run lint
```

### Tuning a run

All benchmark parameters live in `.env` — no code edits needed to change dataset size, iteration counts, or concurrency levels:

```bash
DATASET_TARGET_RELATIONSHIPS=150000   # 100k-500k recommended
BENCH_READ_ITERATIONS=120             # timed samples per read workload (assignment asks for ≥100)
BENCH_WARMUP_ITERATIONS=20            # untimed samples before recording
BENCH_MIXED_DURATION_SECONDS=30       # sustained duration per concurrency level
BENCH_MIXED_CONCURRENCY_LEVELS=1,10,40
BENCH_MIXED_READ_WRITE_RATIO=0.8      # 80% reads / 20% writes
BENCH_BATCH_SIZE=1000                 # rows per UNWIND/saveAll batch during load
```

---

## 5. Results template

`npm run bench:report` fills in the tables below from `results/latest.json` — this is what `results/RESULTS.md` looks like after a run. Placeholder rows are shown here so the report structure is visible before you've run anything against real accounts.

### Data loading

| Platform | Nodes/s | Rels/s | Total wall-clock |
|---|---:|---:|---:|
| CognoDB Cloud | _run pending_ | | |
| Neo4j AuraDB Free | | | |
| Memgraph Cloud | | | |
| ArangoDB Oasis | | | |
| FalkorDB Cloud | | | |

### Traversal latency (p50 / p95)

| Platform | 1-hop | 2-hop | 3-hop |
|---|---|---|---|
| CognoDB Cloud | | | |
| Neo4j AuraDB Free | | | |
| Memgraph Cloud | | | |
| ArangoDB Oasis | | | |
| FalkorDB Cloud | | | |

### Lookups (p50 / p95)

| Platform | Point lookup | Indexed range lookup |
|---|---|---|
| CognoDB Cloud | | |
| Neo4j AuraDB Free | | |
| Memgraph Cloud | | |
| ArangoDB Oasis | | |
| FalkorDB Cloud | | |

### Aggregation (p50 / p95)

| Platform | count/group-by region |
|---|---|
| CognoDB Cloud | |
| Neo4j AuraDB Free | |
| Memgraph Cloud | |
| ArangoDB Oasis | |
| FalkorDB Cloud | |

### Mixed read/write throughput

| Platform | Concurrency | Throughput (qps) | Read/Write mix | Errors |
|---|---:|---:|---|---:|
| CognoDB Cloud | 1 / 10 / 40 | | | |
| Neo4j AuraDB Free | 1 / 10 / 40 | | | |
| Memgraph Cloud | 1 / 10 / 40 | | | |
| ArangoDB Oasis | 1 / 10 / 40 | | | |
| FalkorDB Cloud | 1 / 10 / 40 | | | |

### Footprint

| Platform | Instance spec | Footprint |
|---|---|---|
| CognoDB Cloud | burstable 0.5 vCPU, 256 MB RAM, 1 GB disk | |
| Neo4j AuraDB Free | shared vCPU, 1 GB RAM, 1 GB storage | |
| Memgraph Cloud | 0.5 vCPU, 256 MB RAM, 1 GB disk | |
| ArangoDB Oasis | 2 vCPU / 2 GB RAM shared, capped | |
| FalkorDB Cloud | 0.5 vCPU, 256 MB RAM | |

## 6. Analysis

_To fill in after a real run against live accounts — this is where the "why" goes, e.g.:_
- _Does CognoDB's disk-backed model trade ingest throughput for read latency against Memgraph's in-memory engine?_
- _Does ArangoDB's AQL traversal overhead show up specifically at 3 hops, where multi-model engines historically lag native graph stores?_
- _Do free-tier throttling or cold-start effects explain any outliers better than architecture does?_

---

## 7. Backend architecture notes

This repo is deliberately built as a small production-style backend, not a one-off script, since the runner and the optional API server are things a team would actually operate:

- **Validation** — every env var and every API request body/query is parsed through `zod` schemas; nothing reaches business logic unvalidated ([`src/config/env.ts`](src/config/env.ts), [`src/api/middleware/validate.ts`](src/api/middleware/validate.ts)).
- **Error handling** — a single centralized Express error middleware turns `ZodError`s into structured 400s and any other thrown error into a logged 500, so no route hand-rolls try/catch ([`src/api/middleware/error-handler.ts`](src/api/middleware/error-handler.ts)). The benchmark runner itself never lets one platform's failure abort the run.
- **Retries** — every database call goes through `withRetry`, exponential backoff + jitter, tuned for free-tier throttling/cold-starts ([`src/utils/retry.ts`](src/utils/retry.ts)).
- **Security headers & CORS** — `helmet()` plus an explicit `CORS_ALLOWED_ORIGINS` allow-list, not a wildcard ([`src/api/server.ts`](src/api/server.ts)).
- **Rate limiting** — `express-rate-limit`, configurable window/max via env, protecting both the read endpoints and the (auth-gated) run-trigger endpoint.
- **Caching** — results are memoized behind a short TTL cache (`node-cache`) so a polling dashboard doesn't re-read/parse `results/latest.json` on every request; the cache is invalidated the moment a new run completes ([`src/cache/query-cache.ts`](src/cache/query-cache.ts)).
- **Auth on mutating routes** — triggering a real benchmark run against five cloud databases costs time and quota, so `POST /api/v1/runs` requires a shared-secret `x-api-key` header; read endpoints stay open.
- **Structured logging** — `pino`, JSON in production / pretty-printed in development, with a request ID attached to every HTTP request for traceability.
- **Graceful shutdown** — `SIGTERM`/`SIGINT` drain in-flight requests before exiting.

## 8. Project layout

```
src/
  adapters/        one file per platform + shared Bolt base class + common interface
  config/          validated env config, platform registry
  dataset/         SNAP downloader, synthetic generator, CSV loader
  benchmarks/      ingest / traversal / lookup / aggregation / mixed-workload + orchestrating runner + report generator
  utils/           logger, percentile stats, retry/backoff, seeded random
  cache/           TTL cache wrapper
  api/             Express server, routes, middleware (validation, error handling, auth)
  cli.ts           `load` / `run` / `report` commands
tests/             vitest unit tests (percentile math)
scripts/run-all.sh one-command end-to-end run
results/           generated results JSON + RESULTS.md (gitignored except .gitkeep)
```

## 9. Caveats log

_Real caveats (free-tier throttling, timeouts, query-language quirks encountered) are appended here after each live run, in addition to being embedded per-platform in `results/RESULTS.md`. Honesty about what didn't work cleanly is part of the deliverable — see §7 of the assignment brief._
