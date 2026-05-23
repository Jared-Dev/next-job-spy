/**
 * Output contract appended to every resume template's system prompt. The
 * template prompt carries the content and emphasis rules; this carries the
 * JSON shape that resume generation must return. Keeping it in one place means
 * the shape stays in sync with ResumeDocumentSchema.
 */
export const RESUME_OUTPUT_SPEC = `Output ONLY a JSON object — no prose, no markdown fences — matching this exact shape:
{
  "name": string,
  "headline": string,            // the candidate's target title / professional headline
  "contact": { "email": string, "phone": string, "location": string, "site": string },
  "summary": string,             // the positioning summary paragraph
  "competencies": [ { "category": string, "items": string } ],
  "experience": [ {
    "title": string,
    "company": string,
    "context": string,           // one short line on the company: what it is, its scale
    "scope": string,             // OPTIONAL — team size, budget, reporting line; leadership roles only
    "dates": string,             // e.g. "2021 to Present" or "2019 to 2023"
    "bullets": [ string ]
  } ],
  "earlier": string,             // OPTIONAL — one line collapsing roles older than ~10 years
  "projects": [ { "title": string, "detail": string } ],   // OPTIONAL
  "education": [ { "degree": string, "institution": string, "year": string } ],
  "speaking": [ { "title": string, "detail": string } ]     // OPTIONAL
}

Output rules:
- Emit every required field. Include the optional fields (scope, earlier, projects, speaking) only when the candidate's data supports them; otherwise omit the key entirely.
- "competencies": 3 to 5 rows. Each "items" is a short comma-separated list.
- "contact": take values from the profile. Use an empty string for any contact field the profile does not provide.
- "dates": human-readable ranges using the word "to" (for example "2021 to Present"). Never use an en dash or em dash.
- Never invent companies, titles, dates, metrics, skills, achievements, or schools. Use only what the candidate's profile supports; if the profile lacks something the job wants, omit it silently.
- Drop bullets and roles that do not earn their place for this specific job. Do not pad.`;
