import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { migrate } from '../db/migrate.js';
import { closeDb } from '../db/pool.js';
import { upsertDocument, documentHash, replaceChunks, type NewChunk } from '../db/store.js';
import { parseSections } from './parse.js';
import { chunkSections } from './chunk.js';
import { deterministicPrefix, llmPrefix } from './context.js';
import { getEmbedder, getGenerator } from '../providers/index.js';

const DOC_TITLES: Record<string, string> = {
  'foodie.md': 'Foodie — Food Delivery Platform',
  'lms.md': 'LMS — Course Selling Platform',
  'personal-ai.md': 'Personal AI — Voice Assistant',
  'portfolio.md': 'Portfolio — Personal Website and Ask Randhir',
};

export interface IngestReport {
  doc: string;
  skipped: boolean;
  chunks: number;
  version: number;
}

export async function ingestAll(opts?: { force?: boolean; useLlmPrefix?: boolean; chunkTarget?: number }): Promise<IngestReport[]> {
  const cfg = config();
  await migrate();
  const embedder = getEmbedder();
  const prefixer = opts?.useLlmPrefix && cfg.GEMINI_API_KEY ? getGenerator() : null;
  const dir = cfg.CORPUS_DIR;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort();
  const reports: IngestReport[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const hash = createHash('sha256').update(raw).digest('hex');
    const docId = file.replace(/\.md$/, '');
    const title = DOC_TITLES[file] ?? docId;
    if (!opts?.force && (await documentHash(docId)) === hash) {
      reports.push({ doc: docId, skipped: true, chunks: 0, version: 0 });
      continue;
    }
    const version = await upsertDocument(docId, file, hash);
    const sections = parseSections(raw, title);
    const rawChunks = chunkSections(sections, opts?.chunkTarget ?? 420);
    const docSummary = `${title}. Sections: ${sections.slice(0, 12).map((s) => s.path).join('; ')}`;

    const contextual: string[] = [];
    for (const c of rawChunks) {
      const prefix = prefixer
        ? await llmPrefix(prefixer, title, c.sectionPath, c.text, docSummary)
        : deterministicPrefix(title, c.sectionPath);
      contextual.push(`${prefix}\n${c.text}`);
    }
    const embeddings = await embedder.embed(contextual);
    const chunks: NewChunk[] = rawChunks.map((c, i) => ({
      id: `${docId}:${String(i).padStart(3, '0')}`,
      doc_id: docId,
      doc_version: version,
      section_path: c.sectionPath,
      text: c.text,
      contextual_text: contextual[i],
      embedding: embeddings[i],
      token_count: c.tokenCount,
      acl_groups: ['public'],
    }));
    await replaceChunks(docId, chunks);
    reports.push({ doc: docId, skipped: false, chunks: chunks.length, version });
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ingestAll({ force: process.argv.includes('--force'), useLlmPrefix: process.argv.includes('--llm-prefix') })
    .then(async (r) => {
      for (const rep of r) console.log(rep.skipped ? `${rep.doc}: unchanged, skipped` : `${rep.doc}: ${rep.chunks} chunks (v${rep.version})`);
      await closeDb();
    })
    .catch(async (e) => {
      console.error(e);
      await closeDb();
      process.exit(1);
    });
}
