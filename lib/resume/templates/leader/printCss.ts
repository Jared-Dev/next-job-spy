import { BASE_PRINT_CSS } from '@/lib/resume/styles/basePrintCss';

export const PRINT_CSS = `${BASE_PRINT_CSS}

/* Leader — more breathing room, heavier section labels */
body { font-size: 10.5pt; line-height: 1.42; }
.resume h2 {
  margin: 16px 0 7px;
  letter-spacing: 0.1em;
  font-weight: 700;
}
.resume ul { padding-left: 18px; }
.resume li { margin: 0 0 3px; }
.resume h3 { margin-top: 10px; }
`.trim();
