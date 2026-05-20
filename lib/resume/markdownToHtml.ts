/**
 * Minimal Markdown → HTML for resume content rendered on the print page.
 * Handles the subset Claude actually emits per our templates: headings,
 * paragraphs, lists, bold, italic, links, horizontal rules.
 *
 * Inline styling is intentionally avoided — the print stylesheet owns layout.
 */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return out;
}

export function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  let inList = false;
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    out.push(`<p>${renderInline(paragraphBuf.join(' '))}</p>`);
    paragraphBuf = [];
  };

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      flushParagraph();
      closeList();
      i += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push('<hr class="divider" />');
      i += 1;
      continue;
    }

    const bullet = trimmed.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${renderInline(bullet[1].trim())}</li>`);
      i += 1;
      continue;
    }

    closeList();
    paragraphBuf.push(trimmed);
    i += 1;
  }
  flushParagraph();
  closeList();

  return out.join('\n');
}
