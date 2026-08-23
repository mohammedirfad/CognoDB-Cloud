import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pipeline } from "node:stream/promises";
import { env } from "../config/env";
import { logger } from "../utils/logger";

// raw data directory, relative to the project root. This is where the downloaded
const RAW_DIR = path.join(process.cwd(), "data", "raw");
const SNAP_POKEC_URL = "https://snap.stanford.edu/data/soc-pokec-relationships.txt.gz";

/**
 * Two dataset sources, matching section 5.1 of the assignment:
 *
 *  - "pokec": streams and decompresses a slice of the real SNAP soc-Pokec
 *    social network edge list. Requires outbound internet access to
 *    snap.stanford.edu.
 *  - "synthetic": generates a seeded scale-free graph locally with no
 *    network dependency, so the whole suite (including CI) is runnable
 *    offline. Reviewers can switch DATASET_SOURCE=pokec to use the exact
 *    SNAP data the assignment names as an example.
 */
async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  if (env.DATASET_SOURCE === "synthetic") {
    logger.info("DATASET_SOURCE=synthetic: nothing to download, run `npm run dataset:prepare` next");
    return;
  }

  const dest = path.join(RAW_DIR, "soc-pokec-relationships.txt.gz");
  logger.info({ url: SNAP_POKEC_URL, dest }, "downloading SNAP soc-Pokec dataset");

  const res = await fetch(SNAP_POKEC_URL);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download dataset: HTTP ${res.status}`);
  }

  const fileStream = fs.createWriteStream(dest);
  await pipeline(res.body, fileStream);
  logger.info("download complete");

  // Decompress alongside the original for the prepare step to consume.
  const decompressed = path.join(RAW_DIR, "soc-pokec-relationships.txt");
  await pipeline(fs.createReadStream(dest), zlib.createGunzip(), fs.createWriteStream(decompressed));
  logger.info({ decompressed }, "decompressed dataset ready");
}

main().catch((err) => {
  logger.error({ err: String(err) }, "dataset download failed");
  process.exit(1);
});
