import type { Section } from './parse.js';

/** Rough token estimate (~4 chars/token for English markdown). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface RawChunk {
  sectionPath: string;
  text: string;
  tokenCount: number;
}

const OVERLAP_CHARS = 240;

/**
 * Structural chunking:
 * - a section at or under MAX tokens becomes one chunk;
 * - larger sections split on paragraph boundaries, packing paragraphs up to TARGET;
 * - fenced code blocks and tables are atomic — never split mid-block;
 * - consecutive chunks share a small trailing overlap.
 */
export function chunkSections(sections: Section[], targetTokens = 420): RawChunk[] {
  const TARGET = targetTokens;
  const MAX = Math.round(targetTokens * 1.33);
  const out: RawChunk[] = [];
  for (const sec of sections) {
    const blocks = splitBlocks(sec.text);
    let buf: string[] = [];
    let bufTokens = 0;
    const flush = () => {
      if (!buf.length) return;
      const text = buf.join('\n\n').trim();
      if (text) out.push({ sectionPath: sec.path, text, tokenCount: estimateTokens(text) });
      buf = [];
      bufTokens = 0;
    };
    for (const block of blocks) {
      const bt = estimateTokens(block);
      if (bt > MAX) {
        // Oversized atomic block (long table/code): hard-split on lines as a last resort.
        flush();
        for (const piece of hardSplit(block, MAX)) {
          out.push({ sectionPath: sec.path, text: piece, tokenCount: estimateTokens(piece) });
        }
        continue;
      }
      if (bufTokens + bt > TARGET && buf.length) {
        const prev = buf.join('\n\n');
        flush();
        const tail = prev.slice(-OVERLAP_CHARS).trim();
        if (tail) {
          buf = [tail];
          bufTokens = estimateTokens(tail);
        }
      }
      buf.push(block);
      bufTokens += bt;
    }
    flush();
  }
  return out;
}

/** Split section text into atomic blocks: fenced code, tables, paragraphs. */
export function splitBlocks(text: string): string[] {
  const lines = text.split('\n');
  const blocks: string[] = [];
  let buf: string[] = [];
  let inFence = false;
  const flush = () => {
    const t = buf.join('\n').trim();
    if (t) blocks.push(t);
    buf = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (!inFence) {
        flush();
        inFence = true;
        buf.push(line);
      } else {
        buf.push(line);
        inFence = false;
        flush();
      }
      i++;
      continue;
    }
    if (inFence) {
      buf.push(line);
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      // table run
      flush();
      const tbl: string[] = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        tbl.push(lines[i]);
        i++;
      }
      blocks.push(tbl.join('\n'));
      continue;
    }
    if (line.trim() === '') {
      flush();
      i++;
      continue;
    }
    buf.push(line);
    i++;
  }
  flush();
  return blocks;
}

function hardSplit(block: string, MAX: number): string[] {
  const lines = block.split('\n');
  const pieces: string[] = [];
  let buf: string[] = [];
  let tokens = 0;
  for (const line of lines) {
    const lt = estimateTokens(line);
    if (tokens + lt > MAX && buf.length) {
      pieces.push(buf.join('\n'));
      buf = [];
      tokens = 0;
    }
    buf.push(line);
    tokens += lt;
  }
  if (buf.length) pieces.push(buf.join('\n'));
  return pieces;
}
