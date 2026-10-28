import { db } from '../db/pool.js';

export async function metricsOverview() {
  const pool = db();
  const [traces, latestRun, stages, failures] = await Promise.all([
    pool.query(
      `SELECT count(*)::int AS traces,
              count(*) FILTER (WHERE refused)::int AS refusals,
              COALESCE(sum(token_in + token_out), 0)::int AS tokens
       FROM traces`
    ),
    pool.query('SELECT * FROM eval_runs ORDER BY ts DESC LIMIT 1'),
    pool.query(
      `SELECT stage,
              percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
              avg(latency_ms) AS avg_ms,
              count(*)::int AS n
       FROM trace_spans GROUP BY stage ORDER BY stage`
    ),
    pool.query('SELECT count(*)::int AS n FROM failures'),
  ]);
  return {
    traces: traces.rows[0].traces,
    refusals: traces.rows[0].refusals,
    tokens: traces.rows[0].tokens,
    failureCount: failures.rows[0].n,
    latestEval: latestRun.rows[0] ?? null,
    stageLatency: stages.rows,
  };
}

export async function metricsTrend(days = 30) {
  const r = await db().query(
    `SELECT id, ts, tier, recall_at_10, faithfulness, groundedness, abstention, p95_ms
     FROM eval_runs WHERE ts > now() - ($1 || ' days')::interval ORDER BY ts ASC`,
    [String(days)]
  );
  return r.rows;
}

export async function metricsFailures(limit = 50) {
  const r = await db().query(
    'SELECT id, ts, source, question, class, detail FROM failures ORDER BY ts DESC LIMIT $1',
    [limit]
  );
  return r.rows;
}
