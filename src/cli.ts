import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { buildEnabledAdapters } from "./adapters";
import { loadPreparedDataset } from "./dataset/loader";
import { benchmarkIngest } from "./benchmarks/ingest";
import { runAllBenchmarks, RunManifest } from "./benchmarks/runner";
import { writeReportFile } from "./benchmarks/report";
import { logger } from "./utils/logger";
import { enabledPlatforms } from "./config/platforms";

const program = new Command();
program.name("cognodb-benchmark").description("Reproducible graph database cloud benchmark suite");

program
  .command("load")
  .description("Load the prepared dataset into every configured platform (clears existing data first)")
  .action(async () => {
    const platforms = enabledPlatforms();
    if (platforms.length === 0) {
      logger.error("No platforms configured. Fill in .env from .env.example first.");
      process.exit(1);
    }
    const { nodes, edges } = loadPreparedDataset();
    const adapters = buildEnabledAdapters();
    for (const adapter of adapters) {
      logger.info({ adapter: adapter.id }, "connecting");
      await adapter.connect();
      const result = await benchmarkIngest(adapter, nodes, edges);
      logger.info({ adapter: adapter.id, ...result }, "load complete");
      await adapter.disconnect();
    }
  });

program
  .command("run")
  .description("Run the full benchmark suite (ingest + traversal + lookup + aggregation + mixed workload) on every configured platform")
  .action(async () => {
    const manifest: RunManifest = await runAllBenchmarks();
    logger.info({ platforms: manifest.platforms.map((p) => p.platformId) }, "benchmark run complete");
  });

program
  .command("report")
  .description("Regenerate results/RESULTS.md from the most recent results/latest.json")
  .action(() => {
    const latestPath = path.join(process.cwd(), "results", "latest.json");
    if (!fs.existsSync(latestPath)) {
      logger.error("No results/latest.json found. Run `npm run bench:run` first.");
      process.exit(1);
    }
    const manifest = JSON.parse(fs.readFileSync(latestPath, "utf-8")) as RunManifest;
    const file = writeReportFile(manifest);
    logger.info({ file }, "report regenerated");
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error({ err: String(err) }, "CLI command failed");
  process.exit(1);
});
