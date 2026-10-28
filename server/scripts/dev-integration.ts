/**
 * Local end-to-end verification on a real Postgres (no external services).
 * Uses the dev embedder (no API keys): proves migrate → ingest → retrieve → eval
 * wiring and produces a labelled DEV baseline for Recall@10. Production numbers
 * come from the Gemini embedder.
 */
import { startTestPg } from './pg-boot.js';

const pg = await startTestPg();
process.env.DATABASE_URL = pg.url;

const { ingestAll } = await import('../src/ingest/ingest.js');
const { runEval } = await import('../src/eval/run.js');
const { chunkCount } = await import('../src/db/store.js');
const { closeDb } = await import('../src/db/pool.js');

try {
  const reports = await ingestAll({ force: true });
  for (const r of reports) console.log(`ingest ${r.doc}: ${r.chunks} chunks (v${r.version})`);
  console.log('total chunks:', await chunkCount());
  const summary = await runEval({ tier: 'core' });
  console.log('DEV-BASELINE EVAL (dev embedder, retrieval-only):');
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await closeDb();
  pg.stop();
}
