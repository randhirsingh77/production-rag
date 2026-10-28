# Production RAG — Design Document

*A question-answering system over the owner's own project documentation, built to
production standards on a ₹0 stack, with an observability dashboard that reports
measured quality — retrieval recall, faithfulness, groundedness, latency, cost — and a
nightly evaluation loop that gates every change.*

Research basis: `~/workspace/research_notes/production-grade-rag-system-research-20261028-1738/report.md`
(verified findings: Anthropic contextual retrieval failure reductions 35%/49%/67%;
production metric bands; latency and cost models; failure taxonomies).
Companion docs: `~/workspace/your_files/project-docs/production-rag.md` (architecture
write-up) and `production-rag-build-plan.md` (phased build order with gates).
Golden set: `eval/GOLDEN_SET.md` + `eval/golden_core_100.jsonl` (**built 2026-10-29**).

---

## 1. Requirements

**Functional**
- Ask a question in natural language → receive an answer grounded only in the corpus,
  with citations to the exact chunks used.
- When the corpus does not contain the answer, the system refuses plainly
  ("not in the documents") instead of guessing.
- Documents can be added/updated/removed without downtime; answers always reflect a
  known corpus version.
- Every answer is inspectable: its trace shows what was retrieved, in what order, what
  the answer model saw, and what it cost.
- A dashboard reports quality and latency from real traces and nightly eval runs.

**Non-functional**
- Cost ₹0 — free tiers only (rate/scale limits accepted; quality is not traded away).
- p95 end-to-end latency budget ≈ 1.5 s on free tiers (the ~780 ms class figure needs a
  self-hosted reranker; recorded as a stretch goal, not a promise).
- Corpus v1 ≈ 500–2,000 chunks (4 project documents).
- Solo operator: every component must be operable by one person with managed services.

**Corpus (v1)** — the owner's own project docs, chosen because he can judge every
answer: `food-delivery.md`, `lms.md`, `personal-ai.md`, `portfolio.md`.

## 2. High-level design

Two pipelines meeting at one index, plus a measurement loop around both.

```
OFFLINE — ingestion (runs when documents change)
  sources → parse → clean → structural chunk → contextual prefix → embed
          → Postgres (chunk text + vector + tsvector + metadata, corpus version)

ONLINE — query (runs per question)
  question → rewrite (only if needed) → hybrid retrieve (dense + BM25, RRF)
           → rerank 50 → 6 → pack (dedupe, best-first, token budget)
           → generate (grounded prompt, citations) → verify citations
           → answer | refuse        …every stage timed into a trace

LOOP — evaluation & observability (nightly + continuous)
  traces → Langfuse + metrics tables → failure miner (classify, store)
  golden set → nightly run → scoring (recall by code; faithfulness by calibrated judge)
             → dashboard → failures promoted into the golden set
```

**Components, one job each**
- *Ingestion service* — docs → verified chunks in the index; idempotent, versioned.
- *Index* — a single Postgres (Neon free): pgvector for dense, built-in full-text for
  BM25, metadata columns for filters and access control. One store = one transaction,
  one ACL check, no sync bugs.
- *Query API* — the seven online stages; owns refusal and citation verification.
- *Eval harness* — runs the golden tiers through the same API; paired comparisons.
- *Observability* — Langfuse (free) for traces; own tables for dashboard aggregates.
- *Dashboard + ask UI* — React; the ask-box and the four measurement panels.

## 3. Deep dive

**Data model**
- `documents(id, source, version, content_hash, updated_at)`
- `chunks(id, doc_id, doc_version, section_path, text, contextual_text, embedding,
  tsv, token_count, acl_groups text[], effective_date)`
- `traces(id, ts, question, answer, versions{corpus, embed_model, llm, prompt}, cost_est)`
- `trace_spans(trace_id, stage, latency_ms, detail jsonb)` — retrieved chunk IDs and
  scores, rerank scores, prompt tokens.
- `eval_questions(id, question, type, tier, gold_chunk_id, reference_answer)`
- `eval_runs(id, ts, versions, recall_at_10, faithfulness, groundedness, p95_ms)`
- `eval_results(run_id, question_id, retrieved_ids, scores, judge_reasoning)`
- `failures(id, ts, source[eval|trace], class[low_recall|hallucination|packing|stale],
  detail, promoted_to_golden bool)`
- `feedback(id, trace_id, rating, note)`

**APIs**
- `POST /ask {question}` → `{answer, citations[{chunk_id, doc, section}], trace_id}` or
  a refusal object.
- `POST /ingest` (admin) — re-index changed documents only (hash-compared).
- `GET /metrics/overview` · `GET /metrics/failures` · `POST /feedback {trace_id, rating}`.

**Chunking** — structural boundaries (headings → paragraphs), ~300–500 tokens, ~15%
overlap; tables and code blocks kept whole; every chunk carries `section_path` and a
generated one-sentence context prefix (cached at ingest — paid once, read forever).

**Retrieval** — dense top-50 and BM25 top-50 in parallel, fused with Reciprocal Rank
Fusion (k=60); metadata/ACL filters applied **inside** the SQL before ranking.

**Generation contract** — answer only from the packed sources; cite every claim [S#];
prefer the newest `effective_date` on conflict and say so; output shape
`{answer, citations[], evidence_strength}`; below an evidence threshold → refusal.

**Citation verification** — every [S#] must resolve to a chunk that was actually in the
prompt. Unresolved → regenerate once with stricter instruction → refuse. A citation
that doesn't support its claim is caught by the faithfulness judge in eval, and by
spot-check sampling in production.

**Evaluation design**
- Tiers: **smoke 25** (per-change), **core 100** (hand-built, hand-verified — built),
  **gating 200–300** (core + RAGAS-generated synthetics, spot-checked; the only tier
  allowed to block a release).
- Metrics: Recall@10 (gold chunk in top 10, scored by code), faithfulness (judge:
  supported claims / total claims), groundedness (claims with a *verified* citation),
  abstention correctness on unanswerables.
- Gating statistics: n=100 → ±5.9-point margin; n=200 → ±4.2. Decisions use **paired
  per-question diffs** against the previous run and a judge at temperature 0, so gates
  read signal, not sampling luck.
- Judge calibration: the owner hand-labels a sample of judge outputs before the judge
  is trusted to gate; agreement rate is recorded in `eval_runs`.

**Failure taxonomy** — *low_recall* (≤2 chunks retrieved), *hallucination* (answer
claims unsupported), *packing* (gold chunk retrieved but dropped before the prompt),
*stale* (superseded document won). The nightly miner files each failure; real ones are
promoted into the golden set (+5–10/month).

## 4. Reliability, security, operations

- **Provider failure:** per-stage timeouts; retries with backoff; generation fails over
  Gemini → Groq; rerank API failure degrades to RRF order (logged), never to a hang.
- **Index changes:** blue-green re-embedding — a new embedding model builds a parallel
  index; traffic switches only after the gating set approves it. Deletions are
  tombstoned immediately, purged on the next build.
- **Security:** ACL is a SQL predicate on every retrieval query (never a prompt
  instruction); ingest endpoint admin-only; API keys only in environment variables;
  public ask-box rate-limited to free-tier ceilings.
- **Release rule:** a change ships only if the gating set does not regress beyond the
  agreed margin on paired diffs. The nightly GitHub Actions run is the enforcement.
- **SLOs watched on the dashboard:** faithfulness floor, refusal-rate band (too high =
  retrieval problem; too low = hallucination risk), p95 latency, free-tier quota use.

## 5. Stack (₹0)

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (server + client) | matches the owner's stack |
| Embeddings | Gemini embedding API (free tier) | local bge-m3 for dev |
| Store | Neon Postgres free — pgvector + full-text | one database, both indexes |
| Reranker | Jina/Cohere free tier | bge-reranker-v2-m3 locally in dev |
| Generation + judge | Gemini Flash free tier | Groq free as failover |
| Traces | Langfuse Cloud free | OpenTelemetry-shaped spans |
| Nightly eval | GitHub Actions cron (public repo) | free; also real commit activity |
| Hosting | Render free (API) · Vercel/Pages (UI) | sleep-on-idle accepted |

## 6. Trade-offs — and what to revisit at scale

- **Postgres over a dedicated vector DB:** simpler and free; revisit past ~1M chunks
  (→ Qdrant/pgvector with better indexing) or when filter+ANN latency hurts.
- **Hosted rerank API over self-hosted:** free tier wins now; self-hosting is the route
  to the ~31 ms rerank stage and sub-800 ms p95 later.
- **Flash-class generator:** quality-per-rupee champion on free tier; a frontier model
  is justified only for queries the judge flags as hard (selective escalation).
- **Contextual chunking:** one-time ingest cost per chunk for a large recall win —
  worth it at this corpus size; re-price if the corpus grows 100×.
- **Own fine-tuned embedding/reranker (Phase 8):** once traces yield training triples,
  fine-tuned small models can beat the generic ones on this corpus at ₹0 — they ship
  only if the gating set says they win.
