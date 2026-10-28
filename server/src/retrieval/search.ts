import { denseSearch, bm25Search, type ScoredChunk } from '../db/store.js';
import { getEmbedder, getReranker } from '../providers/index.js';

export interface RankedChunk extends ScoredChunk {
  rrf: number;
  rerankScore?: number;
  denseScore?: number;
  bm25Score?: number;
}

/** Reciprocal Rank Fusion: score = Σ 1/(k + rank) over each list (rank is 1-based).
 *  lists[0] is treated as the dense list, lists[1] as the sparse list, and the
 *  raw per-list scores are preserved for the evidence gate. */
export function rrfFuse(
  lists: ScoredChunk[][],
  k = 60
): RankedChunk[] {
  const acc = new Map<string, RankedChunk>();
  lists.forEach((list, li) => {
    list.forEach((chunk, i) => {
      const add = 1 / (k + i + 1);
      const prev = acc.get(chunk.id);
      if (prev) {
        prev.rrf += add;
        if (li === 0) prev.denseScore = chunk.score;
        if (li === 1) prev.bm25Score = chunk.score;
      } else {
        acc.set(chunk.id, {
          ...chunk,
          rrf: add,
          denseScore: li === 0 ? chunk.score : undefined,
          bm25Score: li === 1 ? chunk.score : undefined,
        });
      }
    });
  });
  return [...acc.values()].sort((a, b) => b.rrf - a.rrf);
}

export interface RetrieveResult {
  candidates: RankedChunk[]; // fused list (pre-rerank), up to pool size
  top: RankedChunk[]; // final list for the prompt
  usedReranker: boolean;
}

export type RetrievalMode = 'hybrid' | 'dense' | 'bm25';

export async function retrieve(
  question: string,
  opts?: { pool?: number; topN?: number; groups?: string[]; mode?: RetrievalMode }
): Promise<RetrieveResult> {
  const pool = opts?.pool ?? 50;
  const topN = opts?.topN ?? 6;
  const groups = opts?.groups ?? ['public'];
  const mode = opts?.mode ?? 'hybrid';
  const embedder = getEmbedder();
  const [qvec] = await embedder.embed([question]);
  const [dense, sparse] = await Promise.all([
    mode === 'bm25' ? Promise.resolve([]) : denseSearch(qvec, pool, groups),
    mode === 'dense' ? Promise.resolve([]) : bm25Search(question, pool, groups),
  ]);
  const fused = mode === 'hybrid' ? rrfFuse([dense, sparse]) : rrfFuse([dense.length ? dense : sparse]);
  const candidates = fused.slice(0, pool);

  const reranker = getReranker();
  if (reranker && candidates.length > topN) {
    try {
      const scores = await reranker.rerank(
        question,
        candidates.map((c) => c.contextual_text)
      );
      const rescored = candidates.map((c, i) => ({ ...c, rerankScore: scores[i] }));
      rescored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));
      return { candidates, top: rescored.slice(0, topN), usedReranker: true };
    } catch (e) {
      console.warn('reranker failed, keeping RRF order:', (e as Error).message);
    }
  }
  return { candidates, top: candidates.slice(0, topN), usedReranker: false };
}
