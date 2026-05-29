/**
 * Output contract appended to every resume template's system prompt. The
 * template prompt carries the content and emphasis rules; this carries the
 * JSON shape that resume generation must return. Keeping it in one place means
 * the shape stays in sync with ResumeDocumentSchema.
 */
export const RESUME_OUTPUT_SPEC = `Output ONLY a JSON object,no prose, no markdown fences,matching this exact shape:
{
  "name": string,
  "headline": string,            // the candidate's target title / professional headline
  "contact": {
    "email": string,
    "phone": string,
    "location": string,          // specific city + state/region,never a bare country
    "site": string,              // personal site if any
    "linkedin": string           // LinkedIn URL,recruiters always look for it
  },
  "summary": string,             // the positioning summary paragraph
  "competencies": [ { "category": string, "items": string } ],
  "experience": [ {
    "title": string,
    "company": string,
    "context": string,           // one short line on what the team does and what this role was set up to do
    "scope": string,             // OPTIONAL,team size, budget, reporting line; leadership roles only
    "dates": string,             // "Mon YYYY to Present" or "Mon YYYY to Mon YYYY"; e.g. "Jan 2021 to Present", "Mar 2019 to Aug 2023"
    "location": string,          // OPTIONAL,city, state OR "Remote"
    "bullets": [ string ],
    "keyResult": string,         // OPTIONAL,the anchor outcome for the role, framed from-to
    "techStack": string          // OPTIONAL,comma-separated tools/keywords used in this role
  } ],
  "earlier": string,             // OPTIONAL,one line collapsing roles older than ~10 years
  "projects": [ { "title": string, "detail": string } ],   // OPTIONAL
  "education": [ {
    "degree": string,
    "institution": string,
    "year": string,
    "gpa": string,               // OPTIONAL,received GPA, two decimal places, e.g. "3.40", "3.62"
    "gpaScale": string,          // OPTIONAL,scale, two decimal places, e.g. "4.00", "5.00". Default "4.00" when GPA is present without an explicit scale.
    "notes": string              // OPTIONAL,one line: specializations, honors, clubs, relevant activities (do NOT put GPA here)
  } ],
  "speaking": [ { "title": string, "detail": string } ],   // OPTIONAL
  "forFun": string               // OPTIONAL,one short line of specific personal interests
}

Output rules:
- Emit every required field. Include optional fields (scope, location, keyResult, techStack, earlier, projects, speaking, gpa, notes, forFun) only when the candidate's data supports them; otherwise omit the key entirely.
- "competencies": 3 to 5 rows. Each "items" is a short comma-separated list. Combine categories rather than padding the section out.
- "contact": take values from the profile. Use an empty string for any contact field the profile does not provide. "location" must be specific (city + state/region); never a bare country.
- "linkedin": pull from profile.links (label "LinkedIn") or profile.personalSite if it's a LinkedIn URL.
- "dates": human-readable ranges using the word "to" with "Mon YYYY" precision on BOTH sides. Always include the month; year-only ranges (e.g. "2021 to Present") are not acceptable, recruiters expect month-level granularity. Use three-letter month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec). Examples: "Jan 2021 to Present", "Mar 2019 to Aug 2023". If the candidate's profile only supplies a year for one end of the range, infer the most plausible month from context (typical start of role, season hinted by surrounding facts) or fall back to "Jan" / "Dec"; never emit a bare year. Never use an en dash or em dash anywhere in the document.
- "keyResult": the anchor metric for the role. Frame it from-to so the result has context (e.g. "Cut billing latency from 6+ hours to near real time"). At most one per role; if the candidate did not provide a concrete from-to number, omit the field rather than inventing one. Resumes loaded with a metric on every bullet read as fabricated,one or two solid anchors per role is the goal.
- "techStack": only include if the candidate's data names specific tools/skills for the role. Keep it concise.
- "gpa" / "gpaScale": if the candidate provided a GPA, output it as a string with exactly two decimal places (e.g. "3.4" becomes "3.40", "3.62" stays "3.62"). Always emit "gpaScale" alongside it, also two decimals, defaulting to "4.00" when the candidate did not specify a scale. If no GPA is present in the profile, omit BOTH fields,do not invent.
- "forFun": one short line, taken from the candidate's profile.forFun if present. Keep it specific and unembarrassed about quirky interests; that is what makes it memorable. Omit the field if the profile has nothing.
- Never invent companies, titles, dates, metrics, skills, achievements, schools, GPAs, or hobbies. Use only what the candidate's profile supports; if the profile lacks something the job wants, omit it silently.
- Brag where the candidate's data supports it. Promotions ("fastest promotion in the division"), awards, marks of distinction, and named recognitions belong on the resume; do not file them down. Resumes are marketing documents.
- Drop bullets and roles that do not earn their place for this specific job. Do not pad to fill a second page; a tight one-pager beats a padded two.`;
