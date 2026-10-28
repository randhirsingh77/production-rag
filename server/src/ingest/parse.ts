/** Markdown → sections. A section is a heading path plus the lines under it. */

export interface Section {
  path: string; // e.g. "Foodie > 17. Own auth (replacing Auth0)"
  text: string; // raw markdown of the section body (heading line excluded)
}

export function parseSections(markdown: string, docTitle: string): Section[] {
  const lines = markdown.split('\n');
  const stack: { level: number; title: string }[] = [];
  const sections: Section[] = [];
  let body: string[] = [];
  let currentPath = docTitle;

  const flush = () => {
    const text = body.join('\n').trim();
    if (text) sections.push({ path: currentPath, text });
    body = [];
  };

  for (const line of lines) {
    const m = /^(#{1,4})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1].length;
      const title = m[2].trim();
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      stack.push({ level, title });
      currentPath = [docTitle, ...stack.map((s) => s.title)].join(' > ');
    } else {
      body.push(line);
    }
  }
  flush();
  return sections;
}
