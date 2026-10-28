import { randomUUID } from 'node:crypto';
import { db } from '../db/pool.js';

export type FailureClass = 'low_recall' | 'hallucination' | 'packing' | 'stale';

/**
 * Failure classification (the design's taxonomy):
 * - gold chunk not in fused candidates at all        → low_recall
 * - gold chunk in candidates but not in the prompt   → packing
 * - answer scored unfaithful                         → hallucination
 * - (stale is assigned when a superseded doc version supplied the answer;
 *    detected by the caller, which knows doc versions)
 */
export function classifyRetrieval(args: {
  goldChunkId: string | null;
  candidateIds: string[];
  packedIds: string[];
}): FailureClass | null {
  if (!args.goldChunkId) return null;
  if (!args.candidateIds.includes(args.goldChunkId)) return 'low_recall';
  if (!args.packedIds.includes(args.goldChunkId)) return 'packing';
  return null;
}

export async function recordFailure(args: {
  source: 'eval' | 'trace';
  refId?: string;
  question?: string;
  cls: FailureClass;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await db().query(
    `INSERT INTO failures(id, source, ref_id, question, class, detail)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), args.source, args.refId ?? null, args.question ?? null, args.cls, JSON.stringify(args.detail ?? {})]
  );
}
