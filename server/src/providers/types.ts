export interface Embedder {
  readonly name: string;
  readonly dim: number;
  embed(texts: string[]): Promise<number[][]>;
}

export interface GenResult {
  text: string;
  tokenIn: number;
  tokenOut: number;
}

export interface Generator {
  readonly name: string;
  generate(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<GenResult>;
}

export interface Reranker {
  readonly name: string;
  /** Returns one relevance score per input document, aligned by index. */
  rerank(query: string, docs: string[]): Promise<number[]>;
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}
