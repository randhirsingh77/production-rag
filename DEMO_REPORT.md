# Demo-Mode Report — 2026-10-29

The system runs **today, with no API keys**, in a deliberately honest demo mode:

- **Embeddings:** a deterministic offline embedder (word-overlap vectors). It is a
  stand-in, not a semantic model — the moment `GEMINI_API_KEY` is set, Gemini
  embeddings replace it with no code change.
- **Answers:** extractive — composed only of verbatim excerpts from the retrieved
  sources, each cited. Extractive answers cannot hallucinate; they are also less
  fluent than LLM answers. Refusals still come from the same evidence gate.

## Experiment ladder (golden core 100, dev embedder)

| Configuration | Chunks | Recall@10 | Abstention | Groundedness* | Failures filed |
|---|---|---|---|---|---|
| Dense only, ~420-token chunks | 119 | 0.693 | 0.833 | 0.667 | 24 |
| BM25 only, ~420-token chunks | 119 | 0.170 | 1.000 | 0.108 | 65 |
| **Hybrid RRF, ~420-token chunks** | 119 | **0.705** | 0.833 | 0.667 | 22 |
| Hybrid RRF, ~300-token chunks | 153 | 0.716 | 0.833 | 0.671 | 22 |

\* Demo groundedness = citation coverage of the extractive answers (no LLM judge
without a key). Faithfulness is reported only in production mode.

**Reading the table (the discipline matters more than the digits):**
- Hybrid beats either retriever alone — the design's core bet holds even on a weak
  embedder. BM25 alone collapses (0.170): real questions paraphrase the docs, and
  exact-term matching can't follow them.
- 300-token chunks beat 420 by +0.011 — exactly **one question**. At n=88 answerable,
  the margin of error is ±~6 points, so this is *not* a proven win. Default stays at
  420 (fewer chunks, same failures); the comparison gets re-run on real embeddings,
  where the answer may differ.
- Abstention is stable at 0.833 (10/12) across dense/hybrid configs.

## Known demo-mode limits (observed, not hidden)

- The evidence gate, fed by the weak dev embedder, refuses some questions the docs
  *do* answer (e.g. the tiffin-plan price) — its cosine scores under-rate real
  matches. Gate calibration is a production-mode task, on real embeddings.
- Extractive sentence picking is crude: for "What accent colour does the portfolio
  use?" it surfaced a true-but-wrong sentence. Real generation fixes this class.
- These numbers measure the *wiring and the method*. Production quality numbers
  start with the Gemini key (embeddings + generation + judge) — see BUILD_TASKS.md.

## Sample Q&A (full pipeline, demo mode)

Raw captures, including the failures above, are in `DEMO_RESULTS.json` — kept
deliberately unedited: a demo that only shows wins teaches nothing.
