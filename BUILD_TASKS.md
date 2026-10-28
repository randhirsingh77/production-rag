# Build Tasks — Production RAG

*What will be built, and how. Method: eval-first, every stage measured on its own
(RAG engineering discipline); requirements → components → deep dive → reliability →
trade-offs (system design); typed providers, traces on everything, versioned
everything (production ML practice).*

## The list

1. **Repo scaffold** — TypeScript server + React client + eval folder, strict folder
   structure (`ingest / retrieval / generation / eval / observability / api`).
   *How:* npm workspaces-free layout, `tsx` for dev, `vitest` for tests, zod-validated
   config from environment variables (fail fast on missing config).
2. **Database schema** — the 9 tables from DESIGN.md.
   *How:* plain SQL migrations run by a small migrator; pgvector used when the
   extension exists (Neon in production), embeddings also stored as arrays so a stock
   Postgres can run the same code with JS-side cosine (dev mode).
3. **Ingestion** — Markdown parser → structural chunker → contextual prefix → embedder.
   *How:* split on headings/paragraphs, ~300–500 token target, 15% overlap, tables and
   code blocks never split; prefix = document + section path (deterministic) with an
   optional LLM-written sentence when a key is configured; embeddings behind a provider
   interface (Gemini in production, a clearly-labelled dev embedder for offline tests).
4. **Retrieval** — dense + BM25 + RRF fusion, ACL filter in SQL.
   *How:* two ranked lists (vector cosine; `ts_rank` over a `tsvector` column) merged
   by Reciprocal Rank Fusion (k=60); `acl_groups` predicate inside both queries.
5. **Rerank + packing** — provider reranker 50 → 6; dedupe, best-first order, token budget.
6. **Generation** — grounded prompt with a strict contract; citation verifier;
   refusal on weak evidence; provider failover Gemini → Groq with timeouts/retries.
7. **Ask API + observability** — `POST /ask`, `/ingest`, `/feedback`, `/metrics/*`;
   every request writes a trace + per-stage spans (latency, chunk IDs, scores, tokens).
8. **Eval harness** — loads the golden JSONL, resolves each gold quote to its chunk,
   measures Recall@10 by code; faithfulness via a calibrated LLM judge; writes
   `eval_runs`/`eval_results`; **failure miner** classifies misses
   (low_recall / hallucination / packing / stale) into the `failures` table.
9. **Client** — ask-box (answer + clickable citations + feedback buttons) and the
   dashboard: pipeline strip with per-stage p95, nightly scores, 30-day trend,
   failure table — all from the metrics endpoints.
10. **Local end-to-end verification** — embedded Postgres in the sandbox: migrate,
    ingest the 4 corpus docs, run the retrieval eval on the golden set, record the
    baseline (dev embedder numbers, labelled as such — real numbers come with the
    Gemini key).
11. **Nightly eval workflow** — GitHub Actions cron that calls the deployed API's eval
    endpoint and commits nothing; activates when repo + secrets exist.
12. **Git** — local repo, one grouped commit per finished piece, short plain messages.

## Demo mode + first experiments (2026-10-29)

The system runs with **no keys** in demo mode: offline dev embedder + extractive
answers (verbatim, cited excerpts — cannot hallucinate, less fluent). Setting
`GEMINI_API_KEY` switches embeddings, generation and judging to production with no
code change. Experiment ladder on the golden set and full interpretation:
`DEMO_REPORT.md` (raw data: `DEMO_RESULTS.json`). Headline: hybrid RRF 0.705
Recall@10 > dense 0.693 > BM25 0.170; abstention 0.833; chunk size 300 vs 420 is a
one-question difference — inside the noise, default stays 420, re-test on real
embeddings.

## Waiting on the owner (one list, morning)

- Gemini API key (free, Google AI Studio) — embeddings + generation + judge.
- Neon Postgres connection string (free account) — production database.
- Rerank key (Jina or Cohere free tier) — or v1 ships with RRF order until it arrives.
- Groq API key (free) — failover provider. Optional for v1.
- Langfuse keys (free) — trace UI; own DB traces work without it.
- GitHub: create the public repo + add the above as Actions secrets; Render deploy of
  the API (his account) when the code is ready to go live.
