/**
 * Print stylesheet for a generated cover letter. Targets the `.cover-letter`
 * wrapper on the print route. Conventional business-letter layout — single
 * column, 1in margins, generous line-height — ATS-safe and PDF-ready.
 */
export const COVER_LETTER_PRINT_CSS = `
:root {
  --cl-fg: #0f172a;
  --cl-muted: #475569;
  --cl-rule: #e2e8f0;
  --cl-accent: var(--mantine-color-indigo-7, #4338ca);
}

@page {
  size: Letter;
  margin: 1in;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  color: var(--cl-fg);
  background: white;
  font-family: var(--font-sans, 'Geist'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.cover-letter {
  max-width: 6.5in;
  margin: 0 auto;
  padding: 0.5in 0;
}

.cover-letter h1 {
  font-size: 16pt;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--cl-accent);
  margin: 0 0 16px;
}

.cover-letter h2 {
  font-size: 12pt;
  font-weight: 600;
  margin: 16px 0 6px;
}

.cover-letter p {
  margin: 0 0 11px;
}

.cover-letter ul {
  margin: 8px 0 11px;
  padding-left: 20px;
}

.cover-letter li {
  margin: 0 0 4px;
}

.cover-letter hr.divider {
  border: none;
  border-top: 1px solid var(--cl-rule);
  margin: 14px 0;
}

.cover-letter a {
  color: var(--cl-fg);
  text-decoration: none;
}

.cover-letter strong {
  font-weight: 600;
}

.cover-letter em {
  font-style: italic;
}

@media print {
  html, body { background: white; }
}
`.trim();
