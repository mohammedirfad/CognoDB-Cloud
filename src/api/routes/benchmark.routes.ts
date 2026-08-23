import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { asyncHandler, NotFoundError } from "../middleware/error-handler";
import { validate } from "../middleware/validate";
import { requireApiKey } from "../middleware/api-key";
import { cached, invalidateAll } from "../../cache/query-cache";
import { runAllBenchmarks } from "../../benchmarks/runner";
import { writeReportFile } from "../../benchmarks/report";
import { enabledPlatforms, PLATFORMS } from "../../config/platforms";
import { env } from "../../config/env";

export const benchmarkRouter = Router();

const RESULTS_DIR = path.join(process.cwd(), "results");

/** GET /platforms - which databases are configured and ready to benchmark. */
benchmarkRouter.get(
  "/platforms",
  asyncHandler(async (_req, res) => {
    const data = PLATFORMS.map((p) => ({ id: p.id, displayName: p.displayName, instanceSpec: p.instanceSpec, enabled: p.enabled }));
    res.json({ platforms: data });
  }),
);

/** GET /results/latest - most recent completed run. */
benchmarkRouter.get(
  "/results/latest",
  asyncHandler(async (_req, res) => {
    const data = await cached("results:latest", env.CACHE_TTL_SECONDS, () => {
      const file = path.join(RESULTS_DIR, "latest.json");
      if (!fs.existsSync(file)) throw new NotFoundError("No benchmark run has completed yet");
      return JSON.parse(fs.readFileSync(file, "utf-8"));
    });
    res.json(data);
  }),
);

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** GET /results?limit=10 - historical run filenames, newest first. */
benchmarkRouter.get(
  "/results",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const files = fs
      .existsSync(RESULTS_DIR)
      ? fs
          .readdirSync(RESULTS_DIR)
          .filter((f) => f.startsWith("run-") && f.endsWith(".json"))
          .sort()
          .reverse()
          .slice(0, limit)
      : [];
    res.json({ runs: files });
  }),
);

/** POST /runs - triggers a full benchmark run against every configured platform. Requires x-api-key. */
benchmarkRouter.post(
  "/runs",
  requireApiKey,
  asyncHandler(async (_req, res) => {
    if (enabledPlatforms().length === 0) {
      res.status(422).json({ error: "NoPlatformsConfigured", message: "Fill in .env before triggering a run" });
      return;
    }
    // Kicks off synchronously and returns the manifest; a production
    // deployment would enqueue this on a job queue instead, since a full
    // run against five cloud databases can take minutes.
    const manifest = await runAllBenchmarks();
    writeReportFile(manifest);
    invalidateAll();
    res.status(201).json(manifest);
  }),
);
