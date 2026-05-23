import { Font } from '@react-pdf/renderer';

/**
 * Shared setup for resume PDF documents: font registration (a side effect on
 * import) and the colour + typeface tokens every template draws from.
 * Templates differ in layout, density, and emphasis — never in palette or
 * typeface, so the resume suite reads as one designed product.
 */

// Embedded OFL fonts. Files are served from /public/fonts as static assets,
// so PDF generation works offline.
Font.register({
  family: 'Source Sans 3',
  fonts: [
    { src: '/fonts/source-sans-3-latin-400-normal.woff', fontWeight: 400 },
    { src: '/fonts/source-sans-3-latin-600-normal.woff', fontWeight: 600 },
  ],
});
Font.register({
  family: 'Source Serif 4',
  fonts: [
    { src: '/fonts/source-serif-4-latin-600-normal.woff', fontWeight: 600 },
  ],
});

// Words wrap whole — no mid-word hyphenation, which reads poorly on a resume.
Font.registerHyphenationCallback((word) => [word]);

export const SANS = 'Source Sans 3';
export const SERIF = 'Source Serif 4';

export const INK = '#111827';
export const NAVY = '#1E3A5F';
export const BODY = '#334155';
export const MUTED = '#6B7280';
export const FAINT = '#94A3B8';
export const COMPANY = '#475569';
export const HAIRLINE = '#E5E7EB';
