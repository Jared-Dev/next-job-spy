import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import { htmlToMarkdown } from '@/lib/jobs/htmlToMarkdown';

interface IReadabilityFields {
  title?: string;
  descriptionMd?: string;
}

/**
 * Run Mozilla Readability over a full page's HTML to recover the main
 * article body. Used as the generic fallback when the bookmarklet ran
 * on a site we don't have hand-tuned selectors for. Readability does
 * a much better job than our JSON-LD/OG heuristics on long-form pages.
 *
 * Returns whatever Readability could find; never throws.
 */
export function extractWithReadability(html: string): IReadabilityFields {
  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    if (!article) return {};
    const fields: IReadabilityFields = {};
    if (article.title) fields.title = article.title.trim() || undefined;
    if (article.content) {
      const md = htmlToMarkdown(article.content).trim();
      if (md) fields.descriptionMd = md;
    }
    return fields;
  } catch {
    return {};
  }
}
