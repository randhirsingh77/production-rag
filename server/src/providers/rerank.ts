import { config } from '../config.js';
import type { Reranker } from './types.js';
import { withTimeout } from './types.js';

export class JinaReranker implements Reranker {
  readonly name = 'jina-reranker-v2-base-multilingual';
  async rerank(query: string, docs: string[]): Promise<number[]> {
    const k = config().JINA_API_KEY;
    if (!k) throw new Error('JINA_API_KEY is not configured');
    const res = await withTimeout(
      fetch('https://api.jina.ai/v1/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({ model: this.name, query, documents: docs, top_n: docs.length }),
      }),
      20_000,
      'jina rerank'
    );
    if (!res.ok) throw new Error(`jina rerank failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { results: { index: number; relevance_score: number }[] };
    const scores = new Array<number>(docs.length).fill(0);
    for (const r of json.results) scores[r.index] = r.relevance_score;
    return scores;
  }
}

export class CohereReranker implements Reranker {
  readonly name = 'rerank-v3.5';
  async rerank(query: string, docs: string[]): Promise<number[]> {
    const k = config().COHERE_API_KEY;
    if (!k) throw new Error('COHERE_API_KEY is not configured');
    const res = await withTimeout(
      fetch('https://api.cohere.com/v2/rerank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({ model: this.name, query, documents: docs, top_n: docs.length }),
      }),
      20_000,
      'cohere rerank'
    );
    if (!res.ok) throw new Error(`cohere rerank failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { results: { index: number; relevance_score: number }[] };
    const scores = new Array<number>(docs.length).fill(0);
    for (const r of json.results) scores[r.index] = r.relevance_score;
    return scores;
  }
}
