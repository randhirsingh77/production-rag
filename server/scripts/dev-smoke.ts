/**
 * Live API smoke on a throwaway Postgres: boots the real Express server and
 * exercises /health, /ingest, /eval/run, /metrics/*, /ask (refusal path) and
 * /feedback over HTTP. Generation requires GEMINI_API_KEY, so answerable
 * questions are covered by the eval harness's retrieval scoring instead.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { startTestPg } from './pg-boot.js';

const API = 'http://127.0.0.1:8799';
const pg = await startTestPg();
process.env.DATABASE_URL = pg.url;

let server: ChildProcess | null = null;
async function waitHealth(): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('API did not become healthy');
}

try {
  server = spawn('npx', ['tsx', 'src/api/server.ts'], {
    env: { ...process.env, DATABASE_URL: pg.url, PORT: '8799' },
    stdio: 'pipe',
  });
  await waitHealth();
  console.log('health: ok');

  const ingest = await (await fetch(`${API}/ingest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json() as {
    reports: { doc: string; chunks: number; skipped: boolean }[];
  };
  console.log('ingest:', ingest.reports.map((r) => `${r.doc}=${r.chunks}`).join(' '));

  const ev = await (await fetch(`${API}/eval/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
  console.log('eval/run:', JSON.stringify(ev));

  const ov = await (await fetch(`${API}/metrics/overview`)).json() as { latestEval?: unknown; stageLatency?: unknown[] };
  console.log('metrics/overview latestEval set:', !!ov.latestEval, '| stage rows:', ov.stageLatency?.length ?? 0);

  const ask = await (await fetch(`${API}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: "What is the LMS platform's refund policy for annual plans?" }),
  })).json() as { refused: boolean; answer: string; traceId: string };
  console.log('ask (unanswerable) refused:', ask.refused, '| answer:', ask.answer);

  const fb = await (await fetch(`${API}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ traceId: ask.traceId, rating: 1 }),
  })).json();
  console.log('feedback:', JSON.stringify(fb));

  const fails = await (await fetch(`${API}/metrics/failures?limit=5`)).json() as unknown[];
  console.log('metrics/failures rows (first page):', fails.length);
} finally {
  server?.kill('SIGTERM');
  pg.stop();
}
