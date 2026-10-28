import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const here = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(here, '../..');

const Env = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  PORT: z.coerce.number().default(8787),
  ADMIN_TOKEN: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  JINA_API_KEY: z.string().optional(),
  COHERE_API_KEY: z.string().optional(),
  EMBED_MODEL: z.string().default('gemini-embedding-001'),
  EMBED_DIM: z.coerce.number().default(768),
  GEN_MODEL: z.string().default('gemini-2.5-flash'),
  JUDGE_MODEL: z.string().default('gemini-2.5-flash'),
  CORPUS_DIR: z.string().default(path.join(PROJECT_ROOT, 'corpus')),
  EVAL_SET: z.string().default(path.join(PROJECT_ROOT, 'eval/golden_core_100.jsonl')),
});

export type Config = z.infer<typeof Env>;

let cached: Config | null = null;
export function config(): Config {
  if (!cached) cached = Env.parse(process.env);
  return cached;
}
