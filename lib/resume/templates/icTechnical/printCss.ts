import { BASE_PRINT_CSS } from '@/lib/resume/styles/basePrintCss';

export const PRINT_CSS = `${BASE_PRINT_CSS}

/* IC technical — dense, content-forward */
body { font-size: 10pt; line-height: 1.38; }
.resume h1 { font-size: 21pt; }
.resume h2 { margin: 12px 0 5px; }
.resume ul { padding-left: 16px; }
.resume li { margin: 0 0 1px; }
`.trim();
