import { createHash } from 'node:crypto';
import type { Embedder } from './types.js';

/**
 * Deterministic offline embedder for development and tests ONLY.
 * Hashes word unigrams+bigrams into a fixed-dim bag-of-features vector.
 * It captures exact-term overlap, not semantics — production uses Gemini.
 */
export class DevEmbedder implements Embedder {
  readonly name = 'dev-hash-embedder';
  readonly dim: number;
  constructor(dim = 768) {
    this.dim = dim;
  }
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => this.one(t));
  }
  private one(text: string): number[] {
    const v = new Array<number>(this.dim).fill(0);
    const words = text.toLowerCase().replace(/[^a-z0-9₹$%. ]/gi, ' ').split(/\s+/).filter(Boolean);
    const feats: string[] = [];
    for (let i = 0; i < words.length; i++) {
      feats.push(words[i]);
      if (i + 1 < words.length) feats.push(words[i] + ' ' + words[i + 1]);
    }
    for (const f of feats) {
      const h = createHash('md5').update(f).digest();
      const idx = h.readUInt32BE(0) % this.dim;
      const sign = h[4] % 2 === 0 ? 1 : -1;
      v[idx] += sign;
    }
    const norm = Math.hypot(...v) || 1;
    return v.map((x) => x / norm);
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
