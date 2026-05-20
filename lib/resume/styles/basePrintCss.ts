export const BASE_PRINT_CSS = `
:root {
  --resume-fg: #0f172a;
  --resume-muted: #475569;
  --resume-rule: #e2e8f0;
  --resume-accent: var(--mantine-color-indigo-7, #4338ca);
}

@page {
  size: Letter;
  margin: 0.6in;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  color: var(--resume-fg);
  background: white;
  font-family: var(--font-sans, 'Geist'), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 10.5pt;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.resume {
  max-width: 7.4in;
  margin: 0 auto;
  padding: 0.4in 0;
}

.resume header {
  margin-bottom: 14px;
}

.resume h1 {
  font-size: 22pt;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--resume-accent);
  margin: 0 0 4px;
  line-height: 1.15;
}

.resume .contact {
  font-size: 11pt;
  color: var(--resume-muted);
}

.resume hr.divider {
  border: none;
  border-top: 1px solid var(--resume-rule);
  margin: 10px 0 14px;
}

.resume h2 {
  font-size: 11pt;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--resume-accent);
  margin: 14px 0 6px;
}

.resume h3 {
  font-size: 11pt;
  font-weight: 600;
  margin: 8px 0 2px;
}

.resume .role-meta {
  font-size: 10pt;
  color: var(--resume-muted);
  margin-bottom: 4px;
}

.resume p {
  margin: 0 0 8px;
}

.resume ul {
  margin: 4px 0 8px;
  padding-left: 18px;
}

.resume li {
  margin: 0 0 2px;
}

.resume a {
  color: var(--resume-fg);
  text-decoration: none;
}

.resume strong {
  font-weight: 600;
}

.resume em {
  font-style: italic;
}

.resume section {
  page-break-inside: avoid;
  break-inside: avoid;
}

@media print {
  html, body { background: white; }
  .no-print { display: none !important; }
}
`.trim();
