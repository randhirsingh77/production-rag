import { db } from './pool.js';
import { vectorMode } from './migrate.js';
import { cosine } from '../providers/dev-embedder.js';

export interface ChunkRow {
  id: string;
  doc_id: string;
  section_path: string;
  text: string;
  contextual_text: string;
  token_count: number;
}

export interface NewChunk extends ChunkRow {
  embedding: number[];
  acl_groups: string[];
  doc_version: number;
}

function vecLiteral(v: number[]): string {
  return '[' + v.map((x) => x.toFixed(6)).join(',') + ']';
}

export async function upsertDocument(id: string, source: string, hash: string): Promise<number> {
  const r = await db().query(
    `INSERT INTO documents(id, source, version, content_hash)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (id) DO UPDATE SET content_hash = EXCLUDED.content_hash,
       version = CASE WHEN documents.content_hash = EXCLUDED.content_hash
                      THEN documents.version ELSE documents.version + 1 END,
       updated_at = now()
     RETURNING version`,
    [id, source, hash]
  );
  return r.rows[0].version as number;
}

export async function documentHash(id: string): Promise<string | null> {
  const r = await db().query('SELECT content_hash FROM documents WHERE id = $1', [id]);
  return r.rows[0]?.content_hash ?? null;
}

export async function replaceChunks(docId: string, chunks: NewChunk[]): Promise<void> {
  const pool = db();
  const vm = await vectorMode();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM chunks WHERE doc_id = $1', [docId]);
    for (const c of chunks) {
      if (vm) {
        await client.query(
          `INSERT INTO chunks(id, doc_id, doc_version, section_path, text, contextual_text,
                              embedding, embedding_vec, token_count, acl_groups)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::vector,$9,$10)`,
          [c.id, c.doc_id, c.doc_version, c.section_path, c.text, c.contextual_text,
           c.embedding, vecLiteral(c.embedding), c.token_count, c.acl_groups]
        );
      } else {
        await client.query(
          `INSERT INTO chunks(id, doc_id, doc_version, section_path, text, contextual_text,
                              embedding, token_count, acl_groups)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [c.id, c.doc_id, c.doc_version, c.section_path, c.text, c.contextual_text,
           c.embedding, c.token_count, c.acl_groups]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export interface ScoredChunk extends ChunkRow {
  score: number;
}

export async function denseSearch(
  queryVec: number[], k: number, groups: string[]
): Promise<ScoredChunk[]> {
  const vm = await vectorMode();
  if (vm) {
    const r = await db().query(
      `SELECT id, doc_id, section_path, text, contextual_text, token_count,
              1 - (embedding_vec <=> $1::vector) AS score
       FROM chunks WHERE acl_groups && $2::text[]
       ORDER BY embedding_vec <=> $1::vector LIMIT $3`,
      [vecLiteral(queryVec), groups, k]
    );
    return r.rows as ScoredChunk[];
  }
  // Dev fallback (no pgvector): cosine in JS over the ACL-filtered set.
  const r = await db().query(
    `SELECT id, doc_id, section_path, text, contextual_text, token_count, embedding
     FROM chunks WHERE acl_groups && $1::text[]`,
    [groups]
  );
  return (r.rows as (ChunkRow & { embedding: number[] })[])
    .map((row) => ({ ...row, score: cosine(queryVec, row.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export async function bm25Search(
  query: string, k: number, groups: string[]
): Promise<ScoredChunk[]> {
  const r = await db().query(
    `SELECT id, doc_id, section_path, text, contextual_text, token_count,
            ts_rank(tsv, websearch_to_tsquery('english', $1)) AS score
     FROM chunks
     WHERE acl_groups && $2::text[] AND tsv @@ websearch_to_tsquery('english', $1)
     ORDER BY score DESC LIMIT $3`,
    [query, groups, k]
  );
  return r.rows as ScoredChunk[];
}

export async function getChunk(id: string): Promise<ChunkRow | null> {
  const r = await db().query(
    'SELECT id, doc_id, section_path, text, contextual_text, token_count FROM chunks WHERE id = $1',
    [id]
  );
  return (r.rows[0] as ChunkRow) ?? null;
}

/** Find the chunk whose raw text contains the quote (gold-quote resolution for eval). */
export async function findChunkByQuote(quote: string): Promise<string | null> {
  const flat = quote.replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  const r = await db().query(
    `SELECT id FROM chunks
     WHERE replace(replace(text, E'\n', ' '), '  ', ' ') LIKE '%' || $1 || '%'
     LIMIT 1`,
    [flat.slice(0, 400)]
  );
  if (r.rows[0]) return r.rows[0].id as string;
  // Fallback: longest distinctive line of the quote
  const lines = flat.split(/(?<=[.!?])\s+/).filter((s) => s.length > 40);
  for (const line of lines) {
    const r2 = await db().query(
      `SELECT id FROM chunks WHERE replace(text, E'\n', ' ') LIKE '%' || $1 || '%' LIMIT 1`,
      [line.slice(0, 300)]
    );
    if (r2.rows[0]) return r2.rows[0].id as string;
  }
  return null;
}

export async function corpusVersion(): Promise<string> {
  const r = await db().query(
    "SELECT COALESCE(string_agg(id || '@' || version, ',' ORDER BY id), 'empty') AS v FROM documents"
  );
  return r.rows[0].v as string;
}

export async function chunkCount(): Promise<number> {
  const r = await db().query('SELECT count(*)::int AS n FROM chunks');
  return r.rows[0].n as number;
}
