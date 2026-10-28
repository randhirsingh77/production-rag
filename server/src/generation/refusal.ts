import type { RankedChunk } from '../retrieval/search.js';

/**
 * Evidence gate: should the system even attempt an answer?
 * Weak evidence → refusal (the design's "answer only when the documents speak").
 * Signal priority: rerank score (calibrated relevance) → best dense cosine →
 * fused-list mass as a last resort. Thresholds are starting values; they get
 * calibrated on the golden set's unanswerable slice once real embeddings land.
 */
const MIN_RERANK = 0.25;
const MIN_DENSE = Number(process.env.EVIDENCE_MIN_DENSE ?? 0.3);

export function evidenceStrength(top: RankedChunk[], candidates: RankedChunk[]): {
  attempt: boolean;
  reason: string;
} {
  if (candidates.length === 0) return { attempt: false, reason: 'no_candidates' };
  if (top.length === 0) return { attempt: false, reason: 'empty_top' };
  const bestRerank = Math.max(...top.map((c) => c.rerankScore ?? -1));
  if (bestRerank >= 0) {
    return bestRerank >= MIN_RERANK
      ? { attempt: true, reason: 'rerank_ok' }
      : { attempt: false, reason: 'rerank_weak' };
  }
  const bestDense = Math.max(...candidates.map((c) => c.denseScore ?? -1));
  if (bestDense >= 0) {
    return bestDense >= MIN_DENSE
      ? { attempt: true, reason: 'dense_ok' }
      : { attempt: false, reason: 'dense_weak' };
  }
  const mass = candidates.slice(0, 5).reduce((s, c) => s + c.rrf, 0);
  return candidates.length >= 3 && mass > 0.04
    ? { attempt: true, reason: 'rrf_ok' }
    : { attempt: false, reason: 'rrf_weak' };
}
