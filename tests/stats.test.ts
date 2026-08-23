import { describe, it, expect } from "vitest";
import { percentile, summarize } from "../src/utils/stats";

describe("percentile", () => {
  it("returns the value itself for a single sample", () => {
    expect(percentile([42], 95)).toBe(42);
  });

  it("computes p50 and p95 on a known distribution", () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    expect(percentile(samples, 50)).toBe(50);
    expect(percentile(samples, 95)).toBe(95);
    expect(percentile(samples, 99)).toBe(99);
  });

  it("handles empty input without throwing", () => {
    expect(percentile([], 50)).toBe(0);
  });
});

describe("summarize", () => {
  it("produces count/mean/min/max consistent with the input", () => {
    const s = summarize([10, 20, 30, 40, 50]);
    expect(s.count).toBe(5);
    expect(s.meanMs).toBe(30);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(50);
    expect(s.p50Ms).toBe(30);
  });

  it("returns zeroed stats for an empty sample set", () => {
    const s = summarize([]);
    expect(s.count).toBe(0);
    expect(s.p95Ms).toBe(0);
  });
});
