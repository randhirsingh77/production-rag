import type { RankedChunk } from './search.js';
import { estimateTokens } from '../ingest/chunk.js';

export interface PackedSource {
  ref: string; // S1, S2, ...
  chunk: RankedChunk;
}

/**
 * Context packing: dedupe near-identical chunks, best-first order,
 * hard token budget. Returns the sources in citation order.
 */
export function packContext(chunks: RankedChunk[], budgetTokens = 2600): PackedSource[] {
  const seen = new Set<string>();
  const out: PackedSource[] = [];
  let used = 0;
  for (const c of chunks) {
    const fingerprint = c.text.replace(/\s+/g, ' ').slice(0, 120);
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    const t = estimateTokens(c.contextual_text);
    if (used + t > budgetTokens && out.length) break;
    used += t;
    out.push({ ref: `S${out.length + 1}`, chunk: c });
  }
  return out;
}
