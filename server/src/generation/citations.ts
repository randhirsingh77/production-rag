import type { PackedSource } from '../retrieval/pack.js';

export interface CitationCheck {
  ok: boolean;
  citedRefs: string[];
  unresolved: string[];
}

/** Extract [S#] citations from an answer and verify each resolves to a packed source. */
export function verifyCitations(answer: string, sources: PackedSource[]): CitationCheck {
  const valid = new Set(sources.map((s) => s.ref));
  const found = [...answer.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
  const citedRefs = [...new Set(found)];
  const unresolved = citedRefs.filter((r) => !valid.has(r));
  return { ok: unresolved.length === 0 && citedRefs.length > 0, citedRefs, unresolved };
}

/** Split an answer into claim-ish sentences for the faithfulness judge. */
export function splitClaims(answer: string): string[] {
  return answer
    .replace(/\[(S\d+)\]/g, '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12);
}

/** Fraction of claims carrying at least one citation marker (groundedness proxy). */
export function citationCoverage(answer: string): number {
  const sentences = answer.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 12);
  if (!sentences.length) return 0;
  const cited = sentences.filter((s) => /\[(S\d+)\]/.test(s)).length;
  return cited / sentences.length;
}
