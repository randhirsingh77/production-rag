import pg from 'pg';
import { config } from '../config.js';

let pool: pg.Pool | null = null;

export function db(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: config().DATABASE_URL, max: 5 });
  }
  return pool;
}

export async function closeDb(): Promise<void> {
  if (pool) await pool.end();
  pool = null;
}
