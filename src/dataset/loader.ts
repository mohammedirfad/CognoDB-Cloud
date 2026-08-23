import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { NodeRecord, EdgeRecord } from "../adapters/types";

const OUT_DIR = path.join(process.cwd(), "data", "processed");

export function loadPreparedDataset(): { nodes: NodeRecord[]; edges: EdgeRecord[] } {
  const nodesPath = path.join(OUT_DIR, "nodes.csv");
  const edgesPath = path.join(OUT_DIR, "edges.csv");
  if (!fs.existsSync(nodesPath) || !fs.existsSync(edgesPath)) {
    throw new Error("No prepared dataset found. Run `npm run dataset:prepare` first.");
  }

  const nodes = parse(fs.readFileSync(nodesPath), { columns: true }).map((r: Record<string, string>) => ({
    id: r.id,
    label: r.label,
    age: Number(r.age),
    region: r.region,
  })) as NodeRecord[];

  const edges = parse(fs.readFileSync(edgesPath), { columns: true }).map((r: Record<string, string>) => ({
    from: r.from,
    to: r.to,
    type: r.type,
  })) as EdgeRecord[];

  return { nodes, edges };
}
