import { config } from '../config.js';
import type { Generator, GenResult } from './types.js';
import { withTimeout } from './types.js';

/** OpenAI-compatible failover generator (Groq free tier). */
export class GroqGenerator implements Generator {
  readonly name = 'llama-3.3-70b-versatile';
  async generate(prompt: string, opts?: { temperature?: number; maxTokens?: number }): Promise<GenResult> {
    const k = config().GROQ_API_KEY;
    if (!k) throw new Error('GROQ_API_KEY is not configured');
    const res = await withTimeout(
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
        body: JSON.stringify({
          model: this.name,
          messages: [{ role: 'user', content: prompt }],
          temperature: opts?.temperature ?? 0.2,
          max_tokens: opts?.maxTokens ?? 1024,
        }),
      }),
      45_000,
      'groq generate'
    );
    if (!res.ok) throw new Error(`groq generate failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: json.choices?.[0]?.message?.content ?? '',
      tokenIn: json.usage?.prompt_tokens ?? 0,
      tokenOut: json.usage?.completion_tokens ?? 0,
    };
  }
}
