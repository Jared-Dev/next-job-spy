/**
 * Lightweight HTML → Markdown for job descriptions. Handles the elements
 * Greenhouse/Lever/RemoteOK actually emit. Not a full HTML parser; intentional
 * trade-off to keep the bundle small and the output predictable.
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  let s = html;

  // Decode entities first so they survive subsequent regex work
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rdquo;/g, '”')
    .replace(/&ldquo;/g, '“')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  // Code blocks first (so we don't mangle them with other rules)
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, body) => `\n\n\`\`\`\n${body}\n\`\`\`\n\n`);

  // Headings
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, body) => `\n\n# ${body.trim()}\n\n`);
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, body) => `\n\n## ${body.trim()}\n\n`);
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, body) => `\n\n### ${body.trim()}\n\n`);
  s = s.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_, body) => `\n\n#### ${body.trim()}\n\n`);

  // Bold / italic
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, (_, _t, body) => `**${body}**`);
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, (_, _t, body) => `*${body}*`);

  // Links
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) =>
    `[${body.replace(/<[^>]+>/g, '')}](${href})`,
  );

  // Lists
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => `\n- ${body.trim()}`);
  s = s.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');

  // Paragraphs and breaks
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, body) => `\n\n${body}\n\n`);
  s = s.replace(/<br\s*\/?>(?!\n)/gi, '  \n');

  // Strip remaining tags
  s = s.replace(/<[^>]+>/g, '');

  // Collapse extra whitespace
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  return s.trim();
}
