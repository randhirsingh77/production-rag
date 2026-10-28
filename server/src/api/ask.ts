import { retrieve } from '../retrieval/search.js';
import { packContext } from '../retrieval/pack.js';
import { evidenceStrength } from '../generation/refusal.js';
import { generateAnswer } from '../generation/generate.js';
import { Tracer } from '../observability/trace.js';
import { corpusVersion } from '../db/store.js';
import { providerStatus } from '../providers/index.js';
import { config } from '../config.js';

export interface AskResponse {
  traceId: string;
  answer: string;
  refused: boolean;
  citations: { ref: string; chunkId: string; doc: string; section: string }[];
  stages: { stage: string; latencyMs: number }[];
}

/** The full online pipeline: retrieve → rerank → pack → gate → generate → verify. */
export async function ask(question: string): Promise<AskResponse> {
  const tracer = new Tracer();
  const versions = {
    corpus: await corpusVersion(),
    embedder: providerStatus().embedder,
    generator: providerStatus().generator,
    prompt: 'grounded-v1',
  };

  tracer.start('retrieve');
  const { candidates, top, usedReranker } = await retrieve(question);
  tracer.end('retrieve', {
    candidateIds: candidates.map((c) => c.id),
    topIds: top.map((c) => c.id),
    usedReranker,
  });

  tracer.start('pack');
  const sources = packContext(top);
  tracer.end('pack', { sourceIds: sources.map((s) => s.chunk.id), tokens: sources.reduce((a, s) => a + s.chunk.token_count, 0) });

  const gate = evidenceStrength(top, candidates);
  let answer = 'Not in the documents.';
  let refused = true;
  let tokenIn = 0;
  let tokenOut = 0;

  if (gate.attempt) {
    tracer.start('generate');
    try {
      const gen = await generateAnswer(question, sources);
      answer = gen.answer;
      refused = gen.refused;
      tokenIn = gen.tokenIn;
      tokenOut = gen.tokenOut;
      tracer.end('generate', { model: gen.model, citationOk: gen.citationOk });
    } catch (e) {
      tracer.end('generate', { error: (e as Error).message });
      throw e;
    }
  } else {
    tracer.span('generate', 0, { skipped: gate.reason });
  }

  await tracer.save({
    question,
    answer,
    refused,
    versions,
    tokenIn,
    tokenOut,
  });

  return {
    traceId: tracer.id,
    answer,
    refused,
    citations: refused
      ? []
      : sources.map((s) => ({ ref: s.ref, chunkId: s.chunk.id, doc: s.chunk.doc_id, section: s.chunk.section_path })),
    stages: tracer.all.map((s) => ({ stage: s.stage, latencyMs: Math.round(s.latencyMs) })),
  };
}

export function versionsTag() {
  return { embedModel: config().EMBED_MODEL, genModel: config().GEN_MODEL };
}
