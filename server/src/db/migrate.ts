import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closeDb } from './pool.js';
import { config } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function migrate(): Promise<{ vectorMode: boolean }> {
  const pool = db();
  const sql = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');
  await pool.query(sql);

  // Progressive enhancement: if pgvector exists, add the vector column + HNSW index.
  let vectorMode = false;
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    const dim = config().EMBED_DIM;
    await pool.query(
      `ALTER TABLE chunks ADD COLUMN IF NOT EXISTS embedding_vec vector(${dim})`
    );
    await pool.query(
      'CREATE INDEX IF NOT EXISTS chunks_vec_idx ON chunks USING hnsw (embedding_vec vector_cosine_ops)'
    );
    vectorMode = true;
  } catch {
    vectorMode = false; // stock Postgres: JS-side cosine fallback
  }
  await pool.query(
    `INSERT INTO store_info(key, value) VALUES ('vector_mode', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [String(vectorMode)]
  );
  return { vectorMode };
}

export async function vectorMode(): Promise<boolean> {
  const r = await db().query(
    "SELECT value FROM store_info WHERE key = 'vector_mode'"
  );
  return r.rows[0]?.value === 'true';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(async (r) => {
      console.log('migrations applied; pgvector mode:', r.vectorMode);
      await closeDb();
    })
    .catch(async (e) => {
      console.error(e);
      await closeDb();
      process.exit(1);
    });
}
