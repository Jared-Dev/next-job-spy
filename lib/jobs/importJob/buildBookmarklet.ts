import { BOOKMARKLET_SOURCE } from './bookmarkletSource';

/**
 * Build the `javascript:...` href the user drags to their bookmarks bar.
 * Inlines the user's app origin so the bookmarklet posts back to the
 * right place (e.g. http://localhost:3000 in dev, the hosted URL once
 * the app is deployed).
 *
 * Line-comment stripping runs FIRST: the minifier collapses newlines,
 * and a surviving `//` would silently eat everything downstream until
 * end-of-input, manifesting as SyntaxError on every click. Comments
 * in the source are convenience for readers, never for the bookmark.
 */
export function buildBookmarklet(origin: string): string {
  const body = BOOKMARKLET_SOURCE.replace('__ORIGIN__', origin)
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/ {2,}/g, ' ');
  return `javascript:${encodeURIComponent(body)}`;
}
