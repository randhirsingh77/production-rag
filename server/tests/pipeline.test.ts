import { describe, it, expect } from 'vitest';
import { rrfFuse } from '../src/retrieval/search.js';
import { verifyCitations, citationCoverage, splitClaims } from '../src/generation/citations.js';
import { evidenceStrength } from '../src/generation/refusal.js';
import { recallAtK, pairedDiffs, p95 } from '../src/eval/score.js';
import { classifyRetrieval } from '../src/eval/miner.js';
import type { ScoredChunk } from '../src/db/store.js';
import type { RankedChunk } from '../src/retrieval/search.js';

function chunk(id: string, score = 1): ScoredChunk {
  return { id, doc_id: 'd', section_path: 's', text: 't', contextual_text: 't', token_count: 1, score };
}

describe('rrfFuse', () => {
  it('rewards chunks ranked by both lists', () => {
    const a = [chunk('x'), chunk('y'), chunk('z')];
    const b = [chunk('y'), chunk('x'), chunk('w')];
    const fused = rrfFuse([a, b]);
    expect(['x', 'y']).toContain(fused[0].id);
    expect(fused.find((c) => c.id === 'w')).toBeDefined();
    expect(fused[0].rrf).toBeGreaterThan(fused[fused.length - 1].rrf);
  });
});

describe('verifyCitations', () => {
  const sources = [
    { ref: 'S1', chunk: { id: 'c1' } as never },
    { ref: 'S2', chunk: { id: 'c2' } as never },
  ];
  it('accepts valid citations', () => {
    const r = verifyCitations('The price is ₹130 [S1] and it serves two [S2].', sources as never);
    expect(r.ok).toBe(true);
  });
  it('rejects invented citations', () => {
    const r = verifyCitations('Made up fact [S9].', sources as never);
    expect(r.ok).toBe(false);
    expect(r.unresolved).toContain('S9');
  });
  it('rejects answers with no citations', () => {
    expect(verifyCitations('No citations at all.', sources as never).ok).toBe(false);
  });
});

describe('citation helpers', () => {
  it('splits claims and measures coverage', () => {
    const ans = 'The plan costs ₹699 [S1]. It includes six meals. Delivery is free above ₹499 [S2].';
    expect(splitClaims(ans).length).toBe(3);
    expect(citationCoverage(ans)).toBeCloseTo(2 / 3);
  });
});

describe('evidenceStrength', () => {
  const rc = (id: string, rrf: number, rerankScore?: number): RankedChunk => ({ ...chunk(id), rrf, rerankScore });
  it('refuses when nothing was retrieved', () => {
    expect(evidenceStrength([], []).attempt).toBe(false);
  });
  it('attempts with a strong rerank score', () => {
    expect(evidenceStrength([rc('a', 0.03, 0.9)], [rc('a', 0.03, 0.9)]).attempt).toBe(true);
  });
  it('refuses with a weak rerank score', () => {
    expect(evidenceStrength([rc('a', 0.03, 0.05)], [rc('a', 0.03, 0.05)]).attempt).toBe(false);
  });
});

describe('score helpers', () => {
  it('recallAtK checks the top-k window', () => {
    expect(recallAtK(['a', 'b', 'c'], 'b', 2)).toBe(true);
    expect(recallAtK(['a', 'b', 'c'], 'c', 2)).toBe(false);
    expect(recallAtK(['a'], null, 10)).toBe(false);
  });
  it('pairedDiffs reports mean delta and counts', () => {
    const before = new Map([['q1', 0.5], ['q2', 1]]);
    const after = new Map([['q1', 1], ['q2', 0.5]]);
    const r = pairedDiffs(before, after);
    expect(r.meanDelta).toBe(0);
    expect(r.improved).toBe(1);
    expect(r.regressed).toBe(1);
  });
  it('p95 picks a high percentile', () => {
    expect(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(10);
  });
});

describe('classifyRetrieval', () => {
  it('labels missing gold as low_recall', () => {
    expect(classifyRetrieval({ goldChunkId: 'g', candidateIds: ['a'], packedIds: ['a'] })).toBe('low_recall');
  });
  it('labels retrieved-but-unpacked gold as packing', () => {
    expect(classifyRetrieval({ goldChunkId: 'g', candidateIds: ['g', 'a'], packedIds: ['a'] })).toBe('packing');
  });
  it('returns null when the gold reached the prompt', () => {
    expect(classifyRetrieval({ goldChunkId: 'g', candidateIds: ['g'], packedIds: ['g'] })).toBeNull();
  });
});
