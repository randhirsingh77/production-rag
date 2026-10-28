import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { db, closeDb } from '../db/pool.js';
import { migrate } from '../db/migrate.js';
import { findChunkByQuote, corpusVersion } from '../db/store.js';
import { retrieve, type RetrievalMode } from '../retrieval/search.js';
import { citationCoverage } from '../generation/citations.js';
import { packContext } from '../retrieval/pack.js';
import { evidenceStrength } from '../generation/refusal.js';
import { generateAnswer } from '../generation/generate.js';
import { judgeAnswer } from './judge.js';
import { classifyRetrieval, recordFailure } from './miner.js';
import { recallAtK, p95, mean } from './score.js';
import { providerStatus } from '../providers/index.js';

interface GoldenQ {
  id: string;
  question: string;
  type: string;
  tier: string;
  smoke?: boolean;
  source_doc: string;
  gold_quote: string;
  reference_answer: string;
}

export interface EvalSummary {
  runId: string;
  tier: string;
  n: number;
  recallAt10: number | null;
  faithfulness: number | null;
  groundedness: number | null;
  abstention: number | null;
  p95Ms: number;
  failuresFiled: number;
}

/**
 * Runs a golden tier through the live pipeline.
 * Retrieval is always scored (code). Generation + judging run only when a
 * generation provider is configured; otherwise the run is retrieval-only and
 * the generation metrics stay null — never faked.
 */
export async function runEval(opts?: { tier?: string; smokeOnly?: boolean; withGeneration?: boolean; retrievalMode?: RetrievalMode }): Promise<EvalSummary> {
  await migrate();
  const cfg = config();
  const lines = fs.readFileSync(cfg.EVAL_SET, 'utf8').trim().split('\n');
  let questions = lines.map((l) => JSON.parse(l) as GoldenQ);
  if (opts?.smokeOnly) questions = questions.filter((q) => q.smoke);
  const tier = opts?.tier ?? (opts?.smokeOnly ? 'smoke' : 'core');
  questions = questions.filter((q) => q.tier === 'core'); // v1: core set is the stored set

  const pool = db();
  for (const q of questions) {
    await pool.query(
      `INSERT INTO eval_questions(id, question, type, tier, source_doc, gold_quote, reference_answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO UPDATE SET question = EXCLUDED.question`,
      [q.id, q.question, q.type, q.tier, q.source_doc, q.gold_quote, q.reference_answer]
    );
  }

  // Generation always runs: with a key it is a real LLM; without one, demo-mode
  // extractive answers. The LLM judge runs only with a key; without one,
  // groundedness falls back to citation coverage and faithfulness stays null.
  const withGen = opts?.withGeneration ?? true;
  const hasJudge = !!cfg.GEMINI_API_KEY;
  const retrievalMode = opts?.retrievalMode ?? 'hybrid';
  const runId = randomUUID();
  // Insert the run row first (eval_results FK), fill in metrics at the end.
  await pool.query(
    `INSERT INTO eval_runs(id, tier, versions, n_questions) VALUES ($1,$2,'{}',$3)`,
    [runId, tier, questions.length]
  );
  const hits: boolean[] = [];
  const faiths: number[] = [];
  const grounds: number[] = [];
  const abstentions: boolean[] = [];
  const latencies: number[] = [];
  let failuresFiled = 0;
  let answerable = 0;

  for (const q of questions) {
    const t0 = performance.now();
    const goldChunkId = q.type === 'unanswerable' ? null : await findChunkByQuote(q.gold_quote);
    const { candidates, top } = await retrieve(q.question, { mode: retrievalMode });
    const sources = packContext(top);
    const latency = performance.now() - t0;
    latencies.push(latency);

    let answer: string | null = null;
    let faith: number | null = null;
    let ground: number | null = null;
    let judgeReason: string | null = null;

    if (q.type === 'unanswerable') {
      const gate = evidenceStrength(top, candidates);
      let refused = !gate.attempt;
      if (gate.attempt && withGen) {
        const gen = await generateAnswer(q.question, sources);
        refused = gen.refused;
        answer = gen.answer;
      }
      abstentions.push(refused);
      await pool.query(
        `INSERT INTO eval_results(run_id, question_id, hit_at_10, retrieved_ids, answer, latency_ms)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [runId, q.id, null, candidates.map((c) => c.id), answer, latency]
      );
      continue;
    }

    answerable++;
    const hit = recallAtK(candidates.map((c) => c.id), goldChunkId, 10);
    hits.push(hit);

    const retrievalFailure = classifyRetrieval({
      goldChunkId,
      candidateIds: candidates.map((c) => c.id),
      packedIds: sources.map((s) => s.chunk.id),
    });
    if (retrievalFailure) {
      await recordFailure({ source: 'eval', refId: runId, question: q.question, cls: retrievalFailure, detail: { questionId: q.id, goldChunkId } });
      failuresFiled++;
    }

    if (withGen) {
      const gate = evidenceStrength(top, candidates);
      if (gate.attempt) {
        const gen = await generateAnswer(q.question, sources);
        answer = gen.answer;
        if (!gen.refused) {
          if (hasJudge) {
            const judged = await judgeAnswer(q.question, gen.answer, sources.map((s) => s.chunk.text));
            faith = judged.faithfulness;
            ground = judged.groundedness;
            judgeReason = judged.reason;
            faiths.push(faith);
            grounds.push(ground);
            if (faith < 0.6) {
              await recordFailure({ source: 'eval', refId: runId, question: q.question, cls: 'hallucination', detail: { questionId: q.id, faithfulness: faith } });
              failuresFiled++;
            }
          } else {
            ground = citationCoverage(gen.answer);
            judgeReason = 'demo mode: citation coverage (no LLM judge)';
            grounds.push(ground);
          }
        }
      }
    }

    await pool.query(
      `INSERT INTO eval_results(run_id, question_id, hit_at_10, retrieved_ids, answer, faithfulness, groundedness, judge_reason, latency_ms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [runId, q.id, hit, candidates.map((c) => c.id), answer, faith, ground, judgeReason, latency]
    );
  }

  const versions = {
    corpus: await corpusVersion(),
    ...providerStatus(),
    retrievalMode,
    generatorUsed: hasJudge ? providerStatus().generator : 'demo-extractive',
  };
  const summary: EvalSummary = {
    runId,
    tier,
    n: questions.length,
    recallAt10: answerable ? hits.filter(Boolean).length / answerable : null,
    faithfulness: faiths.length ? mean(faiths) : null,
    groundedness: grounds.length ? mean(grounds) : null,
    abstention: abstentions.length ? abstentions.filter(Boolean).length / abstentions.length : null,
    p95Ms: Math.round(p95(latencies)),
    failuresFiled,
  };
  await pool.query(
    `UPDATE eval_runs SET versions = $2, recall_at_10 = $3, faithfulness = $4,
       groundedness = $5, abstention = $6, p95_ms = $7 WHERE id = $1`,
    [runId, JSON.stringify(versions), summary.recallAt10, summary.faithfulness, summary.groundedness, summary.abstention, summary.p95Ms]
  );
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEval({ smokeOnly: process.argv.includes('--smoke') })
    .then(async (s) => {
      console.log(JSON.stringify(s, null, 2));
      await closeDb();
    })
    .catch(async (e) => {
      console.error(e);
      await closeDb();
      process.exit(1);
    });
}
