import type { PackedSource } from '../retrieval/pack.js';

/**
 * Demo-mode answering (no LLM key configured): the answer is composed ONLY of
 * verbatim excerpts from the retrieved sources, each with its citation. It is
 * extractive QA — nothing is paraphrased or invented, so it cannot hallucinate;
 * it is also visibly less fluent than LLM generation, which is the honest
 * trade-off of running with no key. The moment GEMINI_API_KEY is set, the
 * pipeline switches to real generation and this path is not used.
 */
export function extractiveAnswer(question: string, sources: PackedSource[]): string {
  const terms = new Set(
    question.toLowerCase().replace(/[^a-z0-9₹ ]/gi, ' ').split(/\s+/).filter((w) => w.length > 2)
  );
  const parts: string[] = [];
  for (const s of sources.slice(0, 3)) {
    const sentences = s.chunk.text
      .replace(/\n+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length > 25);
    if (!sentences.length) continue;
    let best = sentences[0];
    let bestScore = -1;
    for (const sent of sentences) {
      const words = new Set(sent.toLowerCase().replace(/[^a-z0-9₹ ]/gi, ' ').split(/\s+/));
      let score = 0;
      for (const t of terms) if (words.has(t)) score++;
      if (score > bestScore) {
        bestScore = score;
        best = sent;
      }
    }
    parts.push(`${best} [${s.ref}]`);
  }
  return parts.join(' ');
}
