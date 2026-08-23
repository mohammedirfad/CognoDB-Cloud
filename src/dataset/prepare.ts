import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { stringify } from "csv-stringify/sync";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { NodeRecord, EdgeRecord } from "../adapters/types";

const RAW_DIR = path.join(process.cwd(), "data", "raw");
const OUT_DIR = path.join(process.cwd(), "data", "processed");

const REGIONS = ["north", "south", "east", "west", "central"];

/** Small deterministic PRNG (mulberry32) so DATASET_SEED reproduces byte-identical datasets. */
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function fromSynthetic(targetEdges: number, seed: number): Promise<{ nodes: NodeRecord[]; edges: EdgeRecord[] }> {
  const rand = mulberry32(seed);
  // Preferential-attachment (Barabasi-Albert-ish) generator: each new node
  // links to `m` existing nodes chosen with probability proportional to
  // their current degree, producing a realistic scale-free social-graph
  // degree distribution rather than a uniform random graph.
  const m = 4;
  const targetNodes = Math.ceil(targetEdges / m);
  const nodes: NodeRecord[] = [];
  const edges: EdgeRecord[] = [];
  const degreeBag: number[] = []; // node indices, repeated per unit of degree

  for (let i = 0; i < targetNodes; i++) {
    const id = `p${i}`;
    nodes.push({
      id,
      label: "Person",
      age: 18 + Math.floor(rand() * 60),
      region: REGIONS[Math.floor(rand() * REGIONS.length)],
    });

    if (i < m) {
      // Seed a small complete-ish core so early attachment has something to sample from.
      for (let j = 0; j < i; j++) {
        edges.push({ from: id, to: `p${j}`, type: "FOLLOWS" });
        degreeBag.push(i, j);
      }
      continue;
    }

    const targets = new Set<number>();
    while (targets.size < m) {
      const pick = degreeBag[Math.floor(rand() * degreeBag.length)];
      if (pick !== i) targets.add(pick);
    }
    for (const t of targets) {
      edges.push({ from: id, to: `p${t}`, type: "FOLLOWS" });
      degreeBag.push(i, t);
    }

    if (edges.length >= targetEdges) break;
  }

  return { nodes, edges: edges.slice(0, targetEdges) };
}

async function fromPokec(targetEdges: number): Promise<{ nodes: NodeRecord[]; edges: EdgeRecord[] }> {
  const file = path.join(RAW_DIR, "soc-pokec-relationships.txt");
  if (!fs.existsSync(file)) {
    throw new Error(`${file} not found - run \`npm run dataset:download\` first (DATASET_SOURCE=pokec)`);
  }

  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  const nodeSet = new Set<string>();
  const edges: EdgeRecord[] = [];

  for await (const line of rl) {
    if (edges.length >= targetEdges) break;
    const [from, to] = line.trim().split(/\s+/);
    if (!from || !to) continue;
    edges.push({ from, to, type: "FOLLOWS" });
    nodeSet.add(from);
    nodeSet.add(to);
  }
  rl.close();

  const rand = mulberry32(env.DATASET_SEED);
  const nodes: NodeRecord[] = [...nodeSet].map((id) => ({
    id,
    label: "Person",
    age: 18 + Math.floor(rand() * 60),
    region: REGIONS[Math.floor(rand() * REGIONS.length)],
  }));

  return { nodes, edges };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { nodes, edges } =
    env.DATASET_SOURCE === "pokec"
      ? await fromPokec(env.DATASET_TARGET_RELATIONSHIPS)
      : await fromSynthetic(env.DATASET_TARGET_RELATIONSHIPS, env.DATASET_SEED);

  fs.writeFileSync(path.join(OUT_DIR, "nodes.csv"), stringify(nodes, { header: true }));
  fs.writeFileSync(path.join(OUT_DIR, "edges.csv"), stringify(edges, { header: true }));

  const manifest = {
    source: env.DATASET_SOURCE,
    seed: env.DATASET_SEED,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  logger.info(manifest, "dataset prepared");
}

main().catch((err) => {
  logger.error({ err: String(err) }, "dataset preparation failed");
  process.exit(1);
});
