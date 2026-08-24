# Benchmark Results

Run at: 2026-08-24T06:41:00.545Z
Dataset: 37,500 nodes, 1,49,990 relationships

## Data loading

| Platform | Nodes/s | Rels/s | Total wall-clock |
|---|---:|---:|---:|
| CognoDB Cloud | 654.86 | 2,619.26 | 57.3s |
| Neo4j AuraDB Free | 1,916.36 | 7,664.94 | 19.6s |
| Memgraph Cloud | 1,046.09 | 4,184.09 | 35.8s |
| ArangoDB Oasis | 465.06 | 1,860.1 | 80.6s |
| FalkorDB Cloud | 2,899.52 | 11,597.31 | 12.9s |

## Traversal latency (p50 / p95)

| Platform | 1-hop | 2-hop | 3-hop |
|---|---|---|---|
| CognoDB Cloud | p50 263.05ms / p95 302.39ms | p50 261.48ms / p95 283.11ms | p50 262.41ms / p95 266.93ms |
| Neo4j AuraDB Free | p50 59.73ms / p95 67.1ms | p50 59.35ms / p95 61.36ms | p50 59.47ms / p95 77.71ms |
| Memgraph Cloud | p50 163.25ms / p95 164.57ms | p50 163.06ms / p95 205.66ms | p50 163.02ms / p95 164.52ms |
| ArangoDB Oasis | p50 251.23ms / p95 299.03ms | p50 251.78ms / p95 300.92ms | p50 252.89ms / p95 301.02ms |
| FalkorDB Cloud | p50 36.78ms / p95 37.43ms | p50 36.92ms / p95 38.03ms | p50 36.96ms / p95 41.22ms |

## Lookups (p50 / p95)

| Platform | Point lookup | Indexed range lookup |
|---|---|---|
| CognoDB Cloud | p50 262.29ms / p95 264.32ms | p50 295.05ms / p95 306.63ms |
| Neo4j AuraDB Free | p50 58.73ms / p95 62.3ms | p50 60.02ms / p95 65.04ms |
| Memgraph Cloud | p50 163.2ms / p95 165.49ms | p50 166.9ms / p95 169.02ms |
| ArangoDB Oasis | p50 250.7ms / p95 293.47ms | p50 255.16ms / p95 325.32ms |
| FalkorDB Cloud | p50 36.49ms / p95 37.78ms | p50 38.02ms / p95 39.19ms |

## Aggregation (p50 / p95)

| Platform | count/group-by region |
|---|---|
| CognoDB Cloud | p50 303.11ms / p95 358.6ms |
| Neo4j AuraDB Free | p50 74.03ms / p95 92.97ms |
| Memgraph Cloud | p50 176.02ms / p95 178.08ms |
| ArangoDB Oasis | p50 263.11ms / p95 400.13ms |
| FalkorDB Cloud | p50 43.02ms / p95 45.07ms |

## Mixed read/write throughput (concurrency sweep)

| Platform | Concurrency | Throughput (qps) | Read/Write mix | Errors |
|---|---:|---:|---|---:|
| CognoDB Cloud | 1 | 3.76 | 93r / 20w | 0 |
| CognoDB Cloud | 10 | 35.84 | 869r / 215w | 0 |
| CognoDB Cloud | 40 | 144.1 | 3495r / 866w | 0 |
| Neo4j AuraDB Free | 1 | 15.95 | 382r / 97w | 0 |
| Neo4j AuraDB Free | 10 | 173.32 | 4196r / 1015w | 0 |
| Neo4j AuraDB Free | 40 | 657.48 | 15785r / 3975w | 0 |
| Memgraph Cloud | 1 | 6.12 | 148r / 36w | 0 |
| Memgraph Cloud | 10 | 61.87 | 1492r / 373w | 0 |
| Memgraph Cloud | 40 | 248.26 | 5960r / 1525w | 0 |
| ArangoDB Oasis | 1 | 1.06 | 32r / 0w | 7 |
| ArangoDB Oasis | 10 | 5.49 | 183r / 0w | 45 |
| ArangoDB Oasis | 40 | 4.53 | 171r / 0w | 63 |
| FalkorDB Cloud | 1 | 27.31 | 653r / 167w | 0 |
| FalkorDB Cloud | 10 | 272.61 | 6533r / 1653w | 0 |
| FalkorDB Cloud | 40 | 1083.65 | 26151r / 6365w | 0 |

## Footprint

| Platform | Instance spec | Footprint |
|---|---|---|
| CognoDB Cloud | burstable 0.5 vCPU, 256 MB RAM, 1 GB disk (free c0 tier) | not observable (Platform does not expose storage/memory metrics on this tier without APOC or an admin API.) |
| Neo4j AuraDB Free | AuraDB Free: shared vCPU, 1 GB RAM, 1 GB storage | not observable (Platform does not expose storage/memory metrics on this tier without APOC or an admin API.) |
| Memgraph Cloud | Memgraph Cloud free tier: 0.5 vCPU, 256 MB RAM, 1 GB disk | not observable (SHOW STORAGE INFO unavailable on this tier) |
| ArangoDB Oasis | Oasis free trial: 2 vCPU / 2 GB RAM shared, capped to match smallest tier | 3.07 MB stored (via collection.figures()) |
| FalkorDB Cloud | FalkorDB Cloud free tier: 0.5 vCPU, 256 MB RAM | not observable (via GRAPH.MEMORY USAGE) |
