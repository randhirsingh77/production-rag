import { randomUUID } from 'node:crypto';
import { db } from '../db/pool.js';

export interface Span {
  stage: string;
  latencyMs: number;
  detail?: Record<string, unknown>;
}

export class Tracer {
  readonly id = randomUUID();
  private spans: Span[] = [];
  private marks = new Map<string, number>();

  start(stage: string): void {
    this.marks.set(stage, performance.now());
  }
  end(stage: string, detail?: Record<string, unknown>): void {
    const t0 = this.marks.get(stage);
    const latencyMs = t0 ? performance.now() - t0 : 0;
    this.spans.push({ stage, latencyMs, detail });
  }
  span(stage: string, latencyMs: number, detail?: Record<string, unknown>): void {
    this.spans.push({ stage, latencyMs, detail });
  }
  get all(): Span[] {
    return this.spans;
  }
  totalMs(): number {
    return this.spans.reduce((s, x) => s + x.latencyMs, 0);
  }

  async save(args: {
    question: string;
    answer: string | null;
    refused: boolean;
    versions: Record<string, unknown>;
    tokenIn: number;
    tokenOut: number;
  }): Promise<void> {
    const pool = db();
    await pool.query(
      `INSERT INTO traces(id, question, answer, refused, versions, token_in, token_out)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [this.id, args.question, args.answer, args.refused, JSON.stringify(args.versions), args.tokenIn, args.tokenOut]
    );
    for (const s of this.spans) {
      await pool.query(
        'INSERT INTO trace_spans(trace_id, stage, latency_ms, detail) VALUES ($1,$2,$3,$4)',
        [this.id, s.stage, s.latencyMs, JSON.stringify(s.detail ?? {})]
      );
    }
  }
}
