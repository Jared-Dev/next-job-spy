/**
 * Minimal Markdown -> block AST for cover letters. Handles the subset Claude
 * emits per COVER_LETTER_SYSTEM_PROMPT: paragraphs, optional headings, bullet
 * lists, horizontal rules, bold, italic, links.
 *
 * Mirrors `markdownToHtml` so behaviour stays predictable; the difference is
 * that this returns a structured tree the react-pdf renderer can walk. No
 * string escaping is done here; downstream Text nodes own their own escaping.
 */

export type TInlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string }
  | { type: 'link'; value: string; href: string };

export type TBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; inline: TInlineNode[] }
  | { type: 'paragraph'; inline: TInlineNode[] }
  | { type: 'list'; items: TInlineNode[][] }
  | { type: 'divider' };

const STRONG_RE = /\*\*([^*]+)\*\*/;
const EM_RE = /(^|[^*])\*([^*\n]+)\*/;
const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/;

function parseInline(raw: string): TInlineNode[] {
  const out: TInlineNode[] = [];
  let rest = raw;

  while (rest.length > 0) {
    const strong = rest.match(STRONG_RE);
    const link = rest.match(LINK_RE);
    const em = rest.match(EM_RE);

    const candidates = [
      strong ? { kind: 'strong' as const, match: strong } : null,
      link ? { kind: 'link' as const, match: link } : null,
      em ? { kind: 'em' as const, match: em } : null,
    ].filter(
      (c): c is { kind: 'strong' | 'link' | 'em'; match: RegExpMatchArray } =>
        c !== null,
    );

    if (candidates.length === 0) {
      if (rest.length > 0) out.push({ type: 'text', value: rest });
      break;
    }

    const next = candidates.reduce((winner, c) =>
      (c.match.index ?? 0) < (winner.match.index ?? 0) ? c : winner,
    );

    const start = next.match.index ?? 0;
    if (start > 0) {
      out.push({ type: 'text', value: rest.slice(0, start) });
    }

    if (next.kind === 'strong') {
      out.push({ type: 'strong', value: next.match[1] });
      rest = rest.slice(start + next.match[0].length);
    } else if (next.kind === 'link') {
      out.push({ type: 'link', value: next.match[1], href: next.match[2] });
      rest = rest.slice(start + next.match[0].length);
    } else {
      const leading = next.match[1] ?? '';
      if (leading) out.push({ type: 'text', value: leading });
      out.push({ type: 'em', value: next.match[2] });
      rest = rest.slice(start + next.match[0].length);
    }
  }

  return out;
}

export function parseMarkdownBlocks(md: string): TBlock[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: TBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems) return;
    blocks.push({
      type: 'list',
      items: listItems.map((item) => parseInline(item)),
    });
    listItems = null;
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (line === '') {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4,
        inline: parseInline(heading[2].trim()),
      });
      continue;
    }

    if (/^---+$/.test(line) || /^\*\*\*+$/.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'divider' });
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!listItems) listItems = [];
      listItems.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
