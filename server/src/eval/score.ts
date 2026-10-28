/** Pure scoring helpers for the eval harness (unit-tested). */

export function recallAtK(retrievedIds: string[], goldChunkId: string | null, k = 10): boolean {
  if (!goldChunkId) return false;
  return retrievedIds.slice(0, k).includes(goldChunkId);
}

export interface PairedDiff {
  questionId: string;
  before: number;
  after: number;
  delta: number;
}

/** Paired per-question comparison between two runs — the gating statistic. */
export function pairedDiffs(
  before: Map<string, number>,
  after: Map<string, number>
): { diffs: PairedDiff[]; meanDelta: number; improved: number; regressed: number } {
  const diffs: PairedDiff[] = [];
  for (const [id, a] of after) {
    const b = before.get(id);
    if (b === undefined) continue;
    diffs.push({ questionId: id, before: b, after: a, delta: a - b });
  }
  const meanDelta = diffs.length ? diffs.reduce((s, d) => s + d.delta, 0) / diffs.length : 0;
  return {
    diffs,
    meanDelta,
    improved: diffs.filter((d) => d.delta > 0).length,
    regressed: diffs.filter((d) => d.delta < 0).length,
  };
}

export function p95(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))];
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}
