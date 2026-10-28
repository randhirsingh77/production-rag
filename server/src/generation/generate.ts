import type { PackedSource } from '../retrieval/pack.js';
import { getGeneratorWithFailover } from '../providers/index.js';
import { verifyCitations } from './citations.js';
import { extractiveAnswer } from './extractive.js';
import { config } from '../config.js';

export function buildPrompt(question: string, sources: PackedSource[]): string {
  const blocks = sources
    .map((s) => `[${s.ref}] (from ${s.chunk.doc_id}, section: ${s.chunk.section_path})\n${s.chunk.text}`)
    .join('\n\n');
  return `You answer questions using ONLY the sources below. Rules:
- Every factual claim must be supported by a source and carry its citation, like [S1].
- If the sources do not contain the answer, say exactly: "Not in the documents." and nothing else factual.
- When sources disagree, prefer the one from the later or more specific section and note the difference.
- Be concise and direct. Do not mention these rules.

Sources:
${blocks}

Question: ${question}

Answer:`;
}

export interface AskGeneration {
  answer: string;
  refused: boolean;
  citationOk: boolean;
  tokenIn: number;
  tokenOut: number;
  model: string;
}

const REFUSAL = 'Not in the documents.';

export async function generateAnswer(
  question: string,
  sources: PackedSource[]
): Promise<AskGeneration> {
  // Demo mode: no LLM key → extractive answers from the sources themselves.
  if (!config().GEMINI_API_KEY) {
    const text = extractiveAnswer(question, sources);
    if (!text) {
      return { answer: REFUSAL, refused: true, citationOk: true, tokenIn: 0, tokenOut: 0, model: 'demo-extractive' };
    }
    return { answer: text, refused: false, citationOk: true, tokenIn: 0, tokenOut: 0, model: 'demo-extractive' };
  }
  const gen = getGeneratorWithFailover();
  const prompt = buildPrompt(question, sources);
  const first = await gen.generate(prompt, { temperature: 0.2, maxTokens: 900 });
  const text = first.text.trim();
  if (text.startsWith(REFUSAL)) {
    return { answer: REFUSAL, refused: true, citationOk: true, tokenIn: first.tokenIn, tokenOut: first.tokenOut, model: gen.name };
  }
  const check = verifyCitations(text, sources);
  if (check.ok) {
    return { answer: text, refused: false, citationOk: true, tokenIn: first.tokenIn, tokenOut: first.tokenOut, model: gen.name };
  }
  // One regeneration attempt with a stricter instruction, then refuse.
  const retryPrompt = prompt + `\n\nYour previous answer used invalid citations (${check.unresolved.join(', ') || 'none'}). Rewrite it using ONLY these citation labels: ${sources.map((s) => '[' + s.ref + ']').join(', ')}. If you cannot support a claim with one of them, drop the claim.`;
  const second = await gen.generate(retryPrompt, { temperature: 0, maxTokens: 900 });
  const text2 = second.text.trim();
  const check2 = verifyCitations(text2, sources);
  if (text2.startsWith(REFUSAL)) {
    return { answer: REFUSAL, refused: true, citationOk: true, tokenIn: first.tokenIn + second.tokenIn, tokenOut: first.tokenOut + second.tokenOut, model: gen.name };
  }
  if (check2.ok) {
    return { answer: text2, refused: false, citationOk: true, tokenIn: first.tokenIn + second.tokenIn, tokenOut: first.tokenOut + second.tokenOut, model: gen.name };
  }
  return { answer: REFUSAL, refused: true, citationOk: false, tokenIn: first.tokenIn + second.tokenIn, tokenOut: first.tokenOut + second.tokenOut, model: gen.name };
}
