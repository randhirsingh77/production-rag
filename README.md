# Production RAG

I built this retrieval-augmented generation system over my own project
documentation, to production standards: every pipeline stage is measured on its
own, every answer is traced, and a nightly evaluation run gates changes.

**Live quality numbers are produced by the system itself** — Recall@10, faithfulness,
groundedness, abstention accuracy, per-stage latency — and shown on its dashboard.

## Architecture

Two pipelines meeting at one index, plus a measurement loop (see `DESIGN.md`):

- **Ingestion:** parse → structural chunking → contextual prefix → embeddings →
  Postgres (pgvector + full-text in one store).
- **Query:** hybrid retrieval (dense + BM25, RRF fusion) → rerank → context packing →
  grounded generation with verified citations → answer, or a plain refusal when the
  documents don't contain the answer.
- **Evaluation loop:** a hand-verified golden set (100 questions, `eval/`), scored
  nightly — retrieval by code, faithfulness by a calibrated LLM judge — with failures
  auto-classified (low recall / hallucination / packing / stale) and promoted back
  into the golden set.

## Stack

TypeScript throughout. Server: Express + Postgres. Client: React + Vite.
Embeddings/generation/judge: Gemini (free tier). Rerank: Jina/Cohere free tier.
Traces: database-native spans (+ optional Langfuse). Nightly eval: GitHub Actions.

## Run it

```bash
# server
cd server && cp .env.example .env   # set DATABASE_URL (+ GEMINI_API_KEY for real answers)
npm install
npm run migrate
npm run ingest
npm run dev                          # API on :8787

# client
cd client && npm install && npm run dev   # UI on :5173
```

Without `GEMINI_API_KEY` the system runs in a clearly-labelled dev mode: a
deterministic offline embedder, retrieval-only eval, refusal path fully active.

## Configuration

I keep the rest of the server settings in `server/.env.example`, and these are worth knowing up front:

| Setting | Default | What it does |
| --- | --- | --- |
| `CORPUS_DIR` | `<repo root>/corpus` | Where the markdown corpus lives — the docs I ingest and answer from. |
| `EVAL_SET` | `<repo root>/eval/golden_core_100.jsonl` | The golden question set the eval harness scores against. |
| `EVIDENCE_MIN_DENSE` | `0.3` | Minimum best dense cosine score for the evidence gate to attempt an answer when no rerank score exists — a
starting value, calibrated later on the golden set's unanswerable slice. |
| `EMBED_MODEL` | `gemini-embedding-001` | The Gemini model I embed with — a free-tier default, so I leave it unset. |
| `EMBED_DIM` | `768` | The embedding size the model produces. |
| `GEN_MODEL` | `gemini-2.5-flash` | The Gemini model that writes the grounded answers. |
| `JUDGE_MODEL` | `gemini-2.5-flash` | The Gemini model that judges faithfulness in the nightly eval. |
| `ADMIN_TOKEN` | _(unset)_ | The token my admin endpoints require — I set it in `.env` and keep it secret. |

## Evaluate

```
cd server
npm run eval           # full core set
npm run eval -- --smoke # 25-question smoke subset
npm test                # unit tests
```

## Layout

```
server/src/
  ingest/        parser, structural chunker, contextual prefixes, ingest pipeline
  retrieval/    hybrid search (dense + BM25 + RRFq, rerank, context packing
  generation/    grounded prompt, citation verifier, evidence gate (refusal)
  eval/          golden-set runner, scoring, LLM judge, failure miner
  observability/ traces, spans, dashboard metrics
  api/          Express app and the ask pipeline
client/           ask-box + quality dashboard
eval/            golden set (JSONL + notes)
```
