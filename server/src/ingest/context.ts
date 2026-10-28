import type { Generator } from '../providers/types.js';

/**
 * Contextual prefix for a chunk. Default: deterministic, built from the document
 * title + section path (free, reproducible). When an LLM prefixer is configured,
 * it writes one sentence situating the chunk inside its document (Anthropic
 * contextual retrieval) — generated once at ingest and cached in the index.
 */
export function deterministicPrefix(docTitle: string, sectionPath: string): string {
  return `From "${docTitle}", section ${sectionPath}:`;
}

export async function llmPrefix(
  gen: Generator,
  docTitle: string,
  sectionPath: string,
  chunkText: string,
  docSummary: string
): Promise<string> {
  const prompt = `Document: ${docTitle}\nDocument summary: ${docSummary}\nSection: ${sectionPath}\nChunk:\n${chunkText.slice(0, 2000)}\n\nWrite ONE short sentence (max 30 words) that situates this chunk within the document, so a search system can find it. Mention the product/feature and the specific topic. Reply with the sentence only.`;
  const r = await gen.generate(prompt, { temperature: 0, maxTokens: 80 });
  const s = r.text.trim().replace(/\s+/g, ' ');
  return s || deterministicPrefix(docTitle, sectionPath);
}
