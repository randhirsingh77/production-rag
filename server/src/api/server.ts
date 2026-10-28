import express from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { db, closeDb } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { ask } from './ask.js';
import { ingestAll } from '../ingest/ingest.js';
import { runEval } from '../eval/run.js';
import { metricsOverview, metricsTrend, metricsFailures } from '../observability/metrics.js';
import { providerStatus } from '../providers/index.js';
import { z } from 'zod';

const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/health', async (_req, res) => {
  try {
    await db().query('SELECT 1');
    res.json({ ok: true, providers: providerStatus() });
  } catch (e) {
    res.status(503).json({ ok: false, error: (e as Error).message });
  }
});

const AskBody = z.object({ question: z.string().min(3).max(1000) });
app.post('/ask', async (req, res) => {
  const parsed = AskBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'question required (3–1000 chars)' });
  try {
    const out = await ask(parsed.data.question);
    res.json(out);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.post('/ingest', async (req, res) => {
  const token = config().ADMIN_TOKEN;
  if (token && req.header('x-admin-token') !== token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const reports = await ingestAll({ force: !!req.body?.force, useLlmPrefix: !!req.body?.llmPrefix });
    res.json({ reports });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

app.post('/feedback', async (req, res) => {
  const body = z.object({ traceId: z.string(), rating: z.union([z.literal(1), z.literal(-1)]), note: z.string().optional() }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'traceId and rating (1|-1) required' });
  await db().query('INSERT INTO feedback(trace_id, rating, note) VALUES ($1,$2,$3)', [body.data.traceId, body.data.rating, body.data.note ?? null]);
  res.json({ ok: true });
});

app.get('/metrics/overview', async (_req, res) => res.json(await metricsOverview()));
app.get('/metrics/trend', async (req, res) => res.json(await metricsTrend(Number(req.query.days ?? 30))));
app.get('/metrics/failures', async (req, res) => res.json(await metricsFailures(Number(req.query.limit ?? 50))));

app.post('/eval/run', async (req, res) => {
  const token = config().ADMIN_TOKEN;
  if (token && req.header('x-admin-token') !== token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const summary = await runEval({ smokeOnly: !!req.body?.smoke });
    res.json(summary);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export { app };

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => {
      const port = config().PORT;
      app.listen(port, () => console.log(`production-rag API on :${port}`));
    })
    .catch(async (e) => {
      console.error(e);
      await closeDb();
      process.exit(1);
    });
}
