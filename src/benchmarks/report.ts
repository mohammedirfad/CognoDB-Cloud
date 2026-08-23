import fs from "node:fs";
import path from "node:path";
import { RunManifest, PlatformResult } from "./runner";
import { LatencyStats } from "../utils/stats";
import { logger } from "../utils/logger";

function fmtLatency(s: LatencyStats): string {
  if (s.count === 0) return "n/a";
  return `p50 ${s.p50Ms}ms / p95 ${s.p95Ms}ms`;
}

function fmtFootprint(p: PlatformResult): string {
  const { storedDataMb, memoryMb, note } = p.footprint;
  const parts: string[] = [];
  if (typeof storedDataMb === "number") parts.push(`${storedDataMb} MB stored`);
  if (typeof memoryMb === "number") parts.push(`${memoryMb} MB memory`);
  return parts.length ? `${parts.join(", ")} (${note})` : `not observable (${note})`;
}

export function generateReport(manifest: RunManifest): string {
  const lines: string[] = [];
  lines.push(`# Benchmark Results`);
  lines.push("");
  lines.push(`Run at: ${manifest.runAt}`);
  lines.push(`Dataset: ${manifest.dataset.nodeCount.toLocaleString()} nodes, ${manifest.dataset.edgeCount.toLocaleString()} relationships`);
  lines.push("");

  if (manifest.skipped.length) {
    lines.push(`> **Skipped platforms** (no credentials supplied): ${manifest.skipped.map((s) => s.platformId).join(", ")}`);
    lines.push("");
  }

  lines.push("## Data loading");
  lines.push("");
  lines.push("| Platform | Nodes/s | Rels/s | Total wall-clock |");
  lines.push("|---|---:|---:|---:|");
  for (const p of manifest.platforms) {
    lines.push(`| ${p.displayName} | ${p.ingest.nodesPerSecond.toLocaleString()} | ${p.ingest.edgesPerSecond.toLocaleString()} | ${(p.ingest.wallClockMs / 1000).toFixed(1)}s |`);
  }
  lines.push("");

  lines.push("## Traversal latency (p50 / p95)");
  lines.push("");
  lines.push("| Platform | 1-hop | 2-hop | 3-hop |");
  lines.push("|---|---|---|---|");
  for (const p of manifest.platforms) {
    lines.push(`| ${p.displayName} | ${fmtLatency(p.traversal.hop1)} | ${fmtLatency(p.traversal.hop2)} | ${fmtLatency(p.traversal.hop3)} |`);
  }
  lines.push("");

  lines.push("## Lookups (p50 / p95)");
  lines.push("");
  lines.push("| Platform | Point lookup | Indexed range lookup |");
  lines.push("|---|---|---|");
  for (const p of manifest.platforms) {
    lines.push(`| ${p.displayName} | ${fmtLatency(p.lookup.pointLookup)} | ${fmtLatency(p.lookup.indexedLookup)} |`);
  }
  lines.push("");

  lines.push("## Aggregation (p50 / p95)");
  lines.push("");
  lines.push("| Platform | count/group-by region |");
  lines.push("|---|---|");
  for (const p of manifest.platforms) {
    lines.push(`| ${p.displayName} | ${fmtLatency(p.aggregation)} |`);
  }
  lines.push("");

  lines.push("## Mixed read/write throughput (concurrency sweep)");
  lines.push("");
  lines.push("| Platform | Concurrency | Throughput (qps) | Read/Write mix | Errors |");
  lines.push("|---|---:|---:|---|---:|");
  for (const p of manifest.platforms) {
    for (const point of p.mixedWorkload) {
      lines.push(
        `| ${p.displayName} | ${point.concurrency} | ${point.throughputQps} | ${point.readOps}r / ${point.writeOps}w | ${point.errors} |`,
      );
    }
  }
  lines.push("");

  lines.push("## Footprint");
  lines.push("");
  lines.push("| Platform | Instance spec | Footprint |");
  lines.push("|---|---|---|");
  for (const p of manifest.platforms) {
    lines.push(`| ${p.displayName} | ${p.instanceSpec} | ${fmtFootprint(p)} |`);
  }
  lines.push("");

  const failed = manifest.platforms.filter((p) => p.error);
  if (failed.length) {
    lines.push("## Caveats");
    lines.push("");
    for (const p of failed) {
      lines.push(`- **${p.displayName}** run failed: \`${p.error}\``);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function writeReportFile(manifest: RunManifest): string {
  const md = generateReport(manifest);
  const file = path.join(process.cwd(), "results", "RESULTS.md");
  fs.writeFileSync(file, md);
  logger.info({ file }, "report written");
  return file;
}
