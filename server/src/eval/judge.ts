import { getJudge } from '../providers/index.js';
import { splitClaims } from '../generation/citations.js';

export interface JudgeResult {
  faithfulness: number; // supported claims / total claims
  groundedness: number; // claims with a supporting citation among packed sources
  reason: string;
}

/**
 * LLM-as-judge (temperature 0). Scores the answer's claims against the exact
 * source texts the generator saw. Calibrated by the owner against hand labels
 * before it is trusted to gate (agreement rate recorded on the eval run).
 */
export async function judgeAnswer(
  question: string,
  answer: string,
  sourceTexts: string[]
): Promise<JudgeResult> {
  const claims = splitClaims(answer);
  if (!claims.length) return { faithfulness: 0, groundedness: 0, reason: 'no_claims' };
  const judge = getJudge();
  const prompt = `You are a strict evaluation judge for a retrieval system.

Question: ${question}

Sources the system used:
${sourceTexts.map((s, i) => `[S${i + 1}] ${s}`).join('\n\n')}

Answer to judge:
${answer}

Claims in the answer:
${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}

For each claim, decide: supported (a source states it) or unsupported.
Reply with ONLY this JSON: {"supported": <count>, "total": ${claims.length}, "reason": "<one short sentence>"}`;
  const r = await judge.generate(prompt, { temperature: 0, maxTokens: 200 });
  const m = /\{[^}]+\}/.exec(r.text);
  if (!m) return { faithfulness: 0, groundedness: 0, reason: 'judge_parse_failed' };
  const parsed = JSON.parse(m[0]) as { supported: number; total: number; reason?: string };
  const faith = parsed.total > 0 ? parsed.supported / parsed.total : 0;
  // Groundedness: supported claims that also carried a citation in the raw answer.
  const citedSentences = answer.split(/(?<=[.!?])\s+/).filter((s) => /\[(S\d+)\]/.test(s));
  const grounded = claims.length ? Math.min(1, citedSentences.length / claims.length) * (faith > 0 ? 1 : 0) : 0;
  return { faithfulness: faith, groundedness: grounded, reason: parsed.reason ?? '' };
}
