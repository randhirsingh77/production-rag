import { describe, it, expect } from 'vitest';
import { parseSections } from '../src/ingest/parse.js';
import { chunkSections, splitBlocks } from '../src/ingest/chunk.js';

const MD = `# Doc Title

Intro paragraph here.

## Alpha

First alpha paragraph with some text in it.

Second alpha paragraph follows here.

| Col A | Col B |
|---|---|
| 1 | 2 |
| 3 | 4 |

## Beta

\`\`\`ts
const x = 1;
// a code block
\`\`\`

Tail paragraph after code.
`;

describe('parseSections', () => {
  it('tracks heading paths', () => {
    const secs = parseSections(MD, 'Doc');
    const paths = secs.map((s) => s.path);
    expect(paths.some((p) => p.endsWith('> Alpha'))).toBe(true);
    expect(paths.some((p) => p.endsWith('> Beta'))).toBe(true);
  });
});

describe('splitBlocks', () => {
  it('keeps tables atomic', () => {
    const blocks = splitBlocks('para one\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\npara two');
    const table = blocks.find((b) => b.includes('| A | B |'));
    expect(table).toContain('| 1 | 2 |');
  });
  it('keeps fenced code atomic', () => {
    const blocks = splitBlocks('before\n\n```ts\nline1\nline2\n```\n\nafter');
    expect(blocks.some((b) => b.includes('line1') && b.includes('line2'))).toBe(true);
  });
});

describe('chunkSections', () => {
  it('produces chunks with section paths and token counts', () => {
    const chunks = chunkSections(parseSections(MD, 'Doc'));
    expect(chunks.length).toBeGreaterThan(0);
    for (const c of chunks) {
      expect(c.sectionPath.length).toBeGreaterThan(0);
      expect(c.tokenCount).toBeGreaterThan(0);
    }
    const all = chunks.map((c) => c.text).join('\n');
    expect(all).toContain('First alpha paragraph');
    expect(all).toContain('const x = 1');
  });
});
