const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface AskOut {
  traceId: string;
  answer: string;
  refused: boolean;
  citations: { ref: string; chunkId: string; doc: string; section: string }[];
  stages: { stage: string; latencyMs: number }[];
}

export interface Overview {
  traces: number;
  refusals: number;
  tokens: number;
  failureCount: number;
  latestEval: {
    id: string; ts: string; tier: string; n_questions: number;
    recall_at_10: number | null; faithfulness: number | null;
    groundedness: number | null; abstention: number | null; p95_ms: number | null;
  } | null;
  stageLatency: { stage: string; p95: number; avg_ms: number; n: number }[];
}

export interface TrendRow {
  id: string; ts: string; tier: string;
  recall_at_10: number | null; faithfulness: number | null;
  groundedness: number | null; abstention: number | null; p95_ms: number | null;
}

export interface FailureRow {
  id: string; ts: string; source: string; question: string | null;
  class: string; detail: Record<string, unknown>;
}

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  ask: (question: string) =>
    fetch(`${BASE}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    }).then((r) => j<AskOut>(r)),
  feedback: (traceId: string, rating: 1 | -1) =>
    fetch(`${BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traceId, rating }),
    }).then((r) => j<{ ok: boolean }>(r)),
  overview: () => fetch(`${BASE}/metrics/overview`).then((r) => j<Overview>(r)),
  trend: () => fetch(`${BASE}/metrics/trend?days=30`).then((r) => j<TrendRow[]>(r)),
  failures: () => fetch(`${BASE}/metrics/failures?limit=50`).then((r) => j<FailureRow[]>(r)),
};
