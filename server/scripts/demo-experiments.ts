/**
 * Demo-mode experiment ladder on the golden set (no API keys):
 *   1. dense-only retrieval      2. BM25-only retrieval
 *   3. hybrid (RRF)              4. hybrid with smaller chunks (300 vs 420 tokens)
 * Each run is a real eval run over the 100-question core set on the dev
 * embedder — numbers are for comparing configurations, not production quality.
 * Also captures sample Q&A through the full ask pipeline for the demo report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { startTestPg } from './pg-boot.js';

const pg = await startTestPg();
process.env.DATABASE_URL = pg.url;

const { ingestAll } = await import('../src/ingest/ingest.js');
const { runEval } = await import('../src/eval/run.js');
const { ask } = await import('../src/api/ask.js');
const store = await import('../src/db/store.js');
const { closeDb } = await import('../src/db/pool.js');

interface Row {
  config: string;
  chunks: number;
  recallAt10: number | null;
  abstention: number | null;
  groundedness: number | null;
  failures: number;
  p95Ms: number;
}

const rows: Row[] = [];
async function experiment(name: string, chunkTarget: number, mode: 'dense' | 'bm25' | 'hybrid'): Promise<void> {
  await ingestAll({ force: true, chunkTarget });
  const chunks = await store.chunkCount();
  const s = await runEval({ tier: 'core', retrievalMode: mode });
  rows.push({
    config: name,
    chunks,
    recallAt10: s.recallAt10,
    abstention: s.abstention,
    groundedness: s.groundedness,
    failures: s.failuresFiled,
    p95Ms: s.p95Ms,
  });
  console.log(`${name}: recall@10=${s.recallAt10?.toFixed(3)} abstention=${s.abstention?.toFixed(3)} groundedness=${s.groundedness?.toFixed(3)} failures=${s.failuresFiled} chunks=${chunks}`);
}

const SAMPLE_QUESTIONS = [
  'What does the Monthly tiffin plan cost and how many meals does it include?',
  'How much does a delivery driver earn per completed delivery on Foodie?',
  'What is the default pass mark for quizzes in the LMS?',
  'How many tools does the personal AI assistant have in its registry?',
  'What accent colour does the portfolio use?',
  "What is the LMS platform's refund policy for annual plans?",
];

try {
  await experiment('dense-only, chunks ~420t', 420, 'dense');
  await experiment('bm25-only, chunks ~420t', 420, 'bm25');
  await experiment('hybrid RRF, chunks ~420t', 420, 'hybrid');
  await experiment('hybrid RRF, chunks ~300t', 300, 'hybrid');

  // Sample Q&A on the final configuration (hybrid, 300t chunks).
  const samples = [];
  for (const q of SAMPLE_QUESTIONS) {
    const out = await ask(q);
    samples.push({ question: q, answer: out.answer, refused: out.refused, citations: out.citations, stages: out.stages });
    console.log(`Q: ${q}\nA: ${out.answer.slice(0, 220)}${out.answer.length > 220 ? '…' : ''}\n`);
  }

  const report = { generatedAt: new Date().toISOString(), mode: 'demo (dev embedder + extractive answers)', rows, samples };
  const outPath = path.resolve(process.cwd(), '../DEMO_RESULTS.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('wrote', outPath);
} finally {
  await closeDb();
  pg.stop();
}
