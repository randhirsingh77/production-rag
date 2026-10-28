import { useEffect, useState } from 'react';
import { api, type AskOut, type Overview, type TrendRow, type FailureRow } from './api.js';

function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : v.toFixed(2);
}

function AskView() {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<AskOut | null>(null);
  const [err, setErr] = useState('');
  const [voted, setVoted] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr('');
    setVoted(0);
    try {
      setOut(await api.ask(q.trim()));
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Ask the documents</h2>
      <p className="sub">Answers come only from the indexed project documentation — with citations, or a plain refusal.</p>
      <form onSubmit={submit} className="askrow">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. What does the Monthly tiffin plan cost, and how many meals does it include?"
          aria-label="Question"
        />
        <button type="submit" disabled={busy}>{busy ? 'Working…' : 'Ask'}</button>
      </form>
      {err && <p className="err">{err}</p>}
      {out && (
        <div className="answer">
          <p className={out.refused ? 'refused' : ''}>{out.answer}</p>
          {out.citations.length > 0 && (
            <ul className="cites">
              {out.citations.map((c) => (
                <li key={c.ref}><span className="ref">[{c.ref}]</span> {c.doc} — {c.section}</li>
              ))}
            </ul>
          )}
          <div className="stages">
            {out.stages.map((s) => (
              <span key={s.stage} className="chip">{s.stage} {s.latencyMs}ms</span>
            ))}
            <span className="vote">
              <button disabled={voted !== 0} onClick={() => { api.feedback(out.traceId, 1); setVoted(1); }}>👍</button>
              <button disabled={voted !== 0} onClick={() => { api.feedback(out.traceId, -1); setVoted(-1); }}>👎</button>
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function TrendChart({ rows }: { rows: TrendRow[] }) {
  const pts = rows.filter((r) => r.recall_at_10 !== null);
  if (pts.length < 2) return <p className="sub">The 30-day quality trend appears after a few nightly eval runs.</p>;
  const W = 560, H = 140, PAD = 24;
  const x = (i: number) => PAD + (i * (W - 2 * PAD)) / (pts.length - 1);
  const y = (v: number) => H - PAD - v * (H - 2 * PAD);
  const line = (get: (r: TrendRow) => number | null, cls: string) => {
    const d = pts.map((r, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(get(r) ?? 0)}`).join(' ');
    return <path key={cls} d={d} className={cls} fill="none" strokeWidth="2" />;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Quality trend">
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1={PAD} x2={W - PAD} y1={y(g)} y2={y(g)} className="grid" />
      ))}
      {line((r) => r.recall_at_10, 'l-recall')}
      {line((r) => r.faithfulness, 'l-faith')}
      {line((r) => r.groundedness, 'l-ground')}
    </svg>
  );
}

function Dashboard() {
  const [ov, setOv] = useState<Overview | null>(null);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [fails, setFails] = useState<FailureRow[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([api.overview(), api.trend(), api.failures()])
      .then(([o, t, f]) => { setOv(o); setTrend(t); setFails(f); })
      .catch((ex) => setErr((ex as Error).message));
  }, []);

  if (err) return <section className="panel"><p className="err">Dashboard unavailable: {err}</p></section>;
  if (!ov) return <section className="panel"><p className="sub">Loading metrics…</p></section>;
  const ev = ov.latestEval;

  return (
    <>
      <section className="panel">
        <h2>Pipeline — per-stage latency (live traces)</h2>
        <div className="strip">
          {ov.stageLatency.length === 0 && <p className="sub">No traces yet — ask a question first.</p>}
          {ov.stageLatency.map((s) => (
            <div key={s.stage} className="stage">
              <div className="stage-name">{s.stage}</div>
              <div className="stage-val">{s.p95 ? `${Math.round(s.p95)}ms` : '—'}</div>
              <div className="stage-sub">p95 · n={s.n}</div>
            </div>
          ))}
          <div className="stage total">
            <div className="stage-name">traces</div>
            <div className="stage-val">{ov.traces}</div>
            <div className="stage-sub">{ov.refusals} refused · {ov.tokens} tokens</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Nightly evaluation {ev ? `— ${ev.tier} set, ${ev.n_questions} questions` : ''}</h2>
        {ev ? (
          <div className="scores">
            <div className="score"><span>Recall@10</span><strong>{pct(ev.recall_at_10)}</strong></div>
            <div className="score"><span>Faithfulness</span><strong>{pct(ev.faithfulness)}</strong></div>
            <div className="score"><span>Groundedness</span><strong>{pct(ev.groundedness)}</strong></div>
            <div className="score"><span>Abstention</span><strong>{pct(ev.abstention)}</strong></div>
            <div className="score"><span>p95 latency</span><strong>{ev.p95_ms ? `${Math.round(ev.p95_ms)}ms` : '—'}</strong></div>
          </div>
        ) : (
          <p className="sub">No eval run recorded yet.</p>
        )}
        <TrendChart rows={trend} />
        <p className="legend"><span className="dot d-recall" /> Recall@10 <span className="dot d-faith" /> Faithfulness <span className="dot d-ground" /> Groundedness</p>
      </section>

      <section className="panel">
        <h2>Failure cases ({ov.failureCount})</h2>
        {fails.length === 0 ? (
          <p className="sub">No failures classified yet.</p>
        ) : (
          <table className="fails">
            <thead><tr><th>When</th><th>Class</th><th>Question</th><th>Source</th></tr></thead>
            <tbody>
              {fails.map((f) => (
                <tr key={f.id}>
                  <td>{new Date(f.ts).toLocaleString()}</td>
                  <td><span className={`badge b-${f.class}`}>{f.class.replace('_', ' ')}</span></td>
                  <td>{f.question ?? '—'}</td>
                  <td>{f.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

export default function App() {
  const [view, setView] = useState<'ask' | 'dash'>('ask');
  return (
    <main>
      <header>
        <h1>Production RAG</h1>
        <nav>
          <button className={view === 'ask' ? 'on' : ''} onClick={() => setView('ask')}>Ask</button>
          <button className={view === 'dash' ? 'on' : ''} onClick={() => setView('dash')}>Quality dashboard</button>
        </nav>
      </header>
      {view === 'ask' ? <AskView /> : <Dashboard />}
      <footer>Measured, not vibes: every number on the dashboard comes from a trace or an eval run.</footer>
    </main>
  );
}
