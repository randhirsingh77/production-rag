import { config } from '../config.js';
import type { Embedder, Generator, Reranker } from './types.js';
import { GeminiEmbedder, GeminiGenerator } from './gemini.js';
import { GroqGenerator } from './groq.js';
import { DevEmbedder } from './dev-embedder.js';
import { JinaReranker, CohereReranker } from './rerank.js';

export function getEmbedder(): Embedder {
  if (config().GEMINI_API_KEY) return new GeminiEmbedder();
  return new DevEmbedder(config().EMBED_DIM); // offline dev/tests only
}

export function getGenerator(model?: string): Generator {
  if (config().GEMINI_API_KEY) return new GeminiGenerator(model);
  throw new Error('No generation provider configured: set GEMINI_API_KEY');
}

export function getJudge(): Generator {
  if (config().GEMINI_API_KEY) return new GeminiGenerator(config().JUDGE_MODEL);
  throw new Error('No judge provider configured: set GEMINI_API_KEY');
}

/** Primary generator with automatic failover to Groq when configured. */
export function getGeneratorWithFailover(): Generator {
  const primary = getGenerator();
  const groq = config().GROQ_API_KEY ? new GroqGenerator() : null;
  if (!groq) return primary;
  return {
    name: `${primary.name} (failover: ${groq.name})`,
    async generate(prompt, opts) {
      try {
        return await primary.generate(prompt, opts);
      } catch (e) {
        console.warn('primary generator failed, failing over:', (e as Error).message);
        return groq.generate(prompt, opts);
      }
    },
  };
}

/** Returns null when no rerank key is configured — the pipeline then keeps RRF order. */
export function getReranker(): Reranker | null {
  if (config().JINA_API_KEY) return new JinaReranker();
  if (config().COHERE_API_KEY) return new CohereReranker();
  return null;
}

export function providerStatus() {
  const c = config();
  return {
    embedder: c.GEMINI_API_KEY ? c.EMBED_MODEL : 'dev-hash-embedder',
    generator: c.GEMINI_API_KEY ? c.GEN_MODEL : null,
    failover: c.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : null,
    reranker: c.JINA_API_KEY ? 'jina' : c.COHERE_API_KEY ? 'cohere' : null,
  };
}
