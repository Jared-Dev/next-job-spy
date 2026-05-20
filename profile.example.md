<!--
  Next Job Spy — profile template

  This file is the input format for your profile. Fill it in (or have an
  interview/assistant fill it in), then import it in the app at /profile via
  "Import from Markdown". The app runs it through Claude to distill it into the
  structured profile that powers job ranking and resume tailoring.

  HOW TO USE THIS
  - Copy this file to `profile.md` in the project root and edit there. That
    filename is gitignored, so your real profile never gets committed.
  - Replace the placeholder text under each heading with your real content.
  - Keep the `## Headings` exactly as written — they anchor the import.
  - Sections you can't fill: leave the heading, delete the placeholder. Skipping
    a section is fine; it just means less signal for that part.
  - Length guidance per section is in HTML comments like this one. Two numbers:
    a MINIMUM (the floor for that section to be useful) and a RECOMMENDED
    target. They are not maximums.

  ON LENGTH — READ THIS ONCE
  There is no upper limit that hurts you. Write as much as you want. The import
  step distills everything down to what each feature actually needs, so
  over-explaining costs you nothing and usually makes ranking and tailored
  resumes sharper. When in doubt, include it. The minimums exist so a feature
  has something to work with — they are floors, not goals.
-->

# Your Full Name

your.email@example.com · City, State/Country · (optional phone)

<!--
  Identity line above: name on the H1, then a single line of contact basics.
  Minimum: name + email. Recommended: name + email + city/region.
-->

## Headline

Staff Frontend Engineer

<!--
  A short professional title — how you'd label yourself at the top of a resume.
  Minimum: 2 words. Recommended: 3–6 words. One line.
-->

## Personal site

<!--
  Your portfolio / personal site — the recruiter-facing hub. It lands on every
  generated resume, so it gets its own section (separate from "Links" below).
  A site usually holds several things, so give the URL once, then list its
  sections. Each section: a short name, optionally followed by " — " and a
  one-line note on what's there (tailored resumes use those notes to reference
  the site well).
  Minimum: optional — skip the whole section if you don't have a site.
  Recommended: the URL plus 2–5 sections with short notes.
-->

- URL: https://you.example.com
- Portfolio — case studies of shipped products, with outcomes
- Technical blog — posts on frontend architecture, ~monthly
- Interactive resume — a live, filterable version of this document
- About — short bio and how to reach me

## Summary

<!--
  A professional summary in YOUR voice — the tone here is preserved when the
  app generates tailored resumes, so write the way you'd actually want to sound.
  Minimum: 2 sentences. Recommended: 3–5 sentences (~80–120 words).
-->

Write 3–5 sentences about who you are professionally: your focus, your depth,
the kind of impact you've had. Plain, specific, your own voice.

## Career goals

<!--
  Where you want to go next and what you're optimizing for. This sharpens job
  ranking — postings that move you toward these goals score higher.
  Minimum: 1–2 sentences. Recommended: a short paragraph (~50–150 words).
-->

What you want from your next role and the next few years. Be honest about
direction — title growth, a domain shift, more (or less) management, etc.

## Looking for

<!--
  Concrete attributes of a role you'd take. Used directly in ranking.
  Minimum: a few bullets. Recommended: cover comp, location/remote, company
  stage/size, domains, role scope.
-->

- Target titles: e.g. Staff / Principal Frontend Engineer
- Location / remote: e.g. Remote (US), or Hybrid in <city>
- Compensation floor: e.g. $X base
- Company stage/size: e.g. Series B–D, 50–500 people
- Domains of interest: e.g. developer tools, fintech, climate

## Avoiding

<!--
  Deal-breakers — what would make you pass on a role. Used to down-rank.
  Minimum: optional (you can skip this section). Recommended: a few bullets.
-->

- e.g. On-call-heavy roles
- e.g. Industries you won't work in
- e.g. Pure people-management with no IC work

## Working style

<!--
  How you work best — collaboration style, environment, what brings out your
  best work. Helps tailoring frame you for a given team.
  Minimum: optional. Recommended: 2–4 sentences.
-->

A few sentences on how you operate: autonomy vs. structure, async vs. sync,
how you like to collaborate, what environments you thrive in.

## Skills

<!--
  Your skills with a strength rating each. The app's internal scale is:
  Familiar < Proficient < Advanced < Expert.

  USE WHATEVER SCALE YOU ALREADY HAVE. If an interview rated you 0–9, or 1–5,
  or stars, or "years of experience" — just write that. Don't reformat. The
  import maps any scale onto the four internal levels for you.

  Minimum: ~8 skills (ranking needs something to match). Recommended: 20–40.
  Be generous — every real skill is a keyword the matcher and tailored resumes
  can use.
-->

- React — Expert
- TypeScript — Expert
- Next.js — Advanced
- Design systems — Advanced
- Accessibility (WCAG) — Proficient
- Node.js — Proficient
- GraphQL — Familiar

<!-- Other scales work too, e.g.:  "- Rust — 6/9"  or  "- Figma — 3 years" -->

## Experience

<!--
  Your work history, most recent first. Each role: a "### Title · Company"
  heading with dates, an optional one-line role summary, then accomplishment
  bullets. Quantified results matter — they become the bullets in tailored
  resumes, so include metrics wherever you have them.

  Minimum per role: 2 bullets. Recommended: 4–6 bullets. Cover every relevant
  role; older/less-relevant ones can be shorter.
-->

### Senior Frontend Engineer · Example Co · 2022 – Present

One-line summary of the role's scope and your impact (optional but useful).

- Accomplishment with a concrete, quantified result.
- Another accomplishment — what you did and what changed because of it.
- Another. Keep each to one tight sentence.

### Frontend Engineer · Earlier Co · 2019 – 2022

- Accomplishment.
- Accomplishment.

## Education

<!--
  Degrees, bootcamps, certifications. Each: "### Credential · Institution · years".
  Minimum: optional. Recommended: list what you have, with notes if relevant.
-->

### B.S. Computer Science · Some University · 2015 – 2019

Optional notes — honors, relevant coursework, GPA if you want it included.

## Achievements

<!--
  Standalone wins outside of work history — awards, certifications, talks,
  open-source, notable side projects.
  Minimum: optional. Recommended: a handful of bullets if you have them.
-->

- e.g. Speaker, SomeConf 2024 — "Talk title"
- e.g. Maintainer of <open-source project>
- e.g. <Award or certification>

## Links

<!--
  Anything you'd put on a resume or hand a recruiter.
  Minimum: optional. Recommended: LinkedIn + GitHub + portfolio/site.
-->

- LinkedIn: https://linkedin.com/in/you
- GitHub: https://github.com/you
- Portfolio: https://you.example.com
