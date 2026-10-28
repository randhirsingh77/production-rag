import { config } from '../config.js';
import type { Embedder, Generator, GenResult } from './types.js';
import { withTimeout } from './types.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

function key(): string {
  const k = config().GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY is not configured');
  return k;
}

export class GeminiEmbedder implements Embedder {
  readonly name: string;
  readonly dim: number;
  constructor() {
    this.name = config().EMBED_MODEL;
    this.dim = config().EMBED_DIM;
  }
  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    const BATCH = 100;
    for (let i = 0; i < texts.length; i += BATCH) {
      const slice = texts.slice(i, i + BATCH);
      const res = await withTimeout(
        fetch(`${BASE}/models/${this.name}:batchEmbedContents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
          body: JSON.stringify({
            requests: slice.map((t) => ({
              model: `models/${this.name}`,
              content: { parts: [{ text: t }] },
              outputDimensionality: this.dim,
            })),
          }),
        }),
        60_000,
        'gemini embed'
      );
      if (!res.ok) throw new Error(`gemini embed failed: ${res.status} ${await res.text()}`);
      const json = (await res.json()) as { embeddings: { values: number[] }[] };
      for (const e of json.embeddings) out.push(e.values);
    }
    return out;
  }
}

export class GeminiGenerator implements Generator {
  readonly name: string;
  constructor(model?: string) {
    this.name = model ?? config().GEN_MODEL;
  }
  async generate(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<GenResult> {
    const res = await withTimeout(
      fetch(`${BASE}/models/${this.name}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key() },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts?.temperature ?? 0.2,
            maxOutputTokens: opts?.maxTokens ?? 1024,
          },
        }),
      }),
      45_000,
      'gemini generate'
    );
    if (!res.ok) throw new Error(`gemini generate failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    return {
      text,
      tokenIn: json.usageMetadata?.promptTokenCount ?? 0,
      tokenOut: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  }
}
