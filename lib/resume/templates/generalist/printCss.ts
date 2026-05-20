import { BASE_PRINT_CSS } from '@/lib/resume/styles/basePrintCss';

export const PRINT_CSS = `${BASE_PRINT_CSS}

/* Generalist — narrative-friendly, slightly more whitespace */
body { font-size: 10.5pt; line-height: 1.46; }
.resume .summary p { margin-bottom: 10px; }
.resume h2 { margin: 16px 0 8px; }
.resume ul { padding-left: 18px; }
.resume li { margin: 0 0 4px; }
`.trim();
