<!--
  Next Job Spy, profile template

  This file is the input format for your profile. Fill it in (or have an
  interview/assistant fill it in), then import it in the app at /profile via
  "Import from Markdown". The app runs it through Claude to distill it into the
  structured profile that powers job ranking and resume tailoring.

  HOW TO USE THIS
  - Copy this file to `profile.md` in the project root and edit there. That
    filename is gitignored, so your real profile never gets committed.
  - Replace the placeholder text under each heading with your real content.
  - Keep the `## Headings` exactly as written, they anchor the import.
  - Sections you can't fill: leave the heading, delete the placeholder. Skipping
    a section is fine; it just means less signal for that part.
  - Length guidance per section is in HTML comments like this one. Two numbers:
    a MINIMUM (the floor for that section to be useful) and a RECOMMENDED
    target. They are not maximums.

  ON LENGTH, READ THIS ONCE
  There is no upper limit that hurts you. Write as much as you want. The import
  step distills everything down to what each feature actually needs, so
  over-explaining costs you nothing and usually makes ranking and tailored
  resumes sharper. When in doubt, include it. The minimums exist so a feature
  has something to work with, they are floors, not goals.
-->

# Your Full Name

your.email@example.com · City, State (or City, Country) · (optional phone) · linkedin.com/in/you

<!--
  Identity line above: name on the H1, then a single line of contact basics.
  Be specific with location: a city + state/region beats a bare country every
  time. Recruiters trust "Plano, TX" or "Berlin, Germany" more than just "USA".
  Include your LinkedIn URL here too, recruiters always look for it, and the
  generated resume puts it in its own slot in the header.
  Minimum: name + email. Recommended: name + email + city/region + LinkedIn.
-->

## Headline

Staff Frontend Engineer

<!--
  A short professional title, how you'd label yourself at the top of a resume.
  The generated resume's summary will combine this with your years of
  experience and main skills (the three things a recruiter scans for in the
  first seven seconds).
  Minimum: 2 words. Recommended: 3 to 6 words. One line.
-->

## Personal site

<!--
  Your portfolio / personal site, the recruiter-facing hub. It lands on every
  generated resume, so it gets its own section (separate from "Links" below).
  A site usually holds several things, so give the URL once, then list its
  sections. Each section: a short name, optionally followed by "," and a
  one-line note on what's there (tailored resumes use those notes to reference
  the site well).
  Minimum: optional, skip the whole section if you don't have a site.
  Recommended: the URL plus 2 to 5 sections with short notes.
-->

- URL: https://you.example.com
- Portfolio, case studies of shipped products, with outcomes
- Technical blog, posts on frontend architecture, ~monthly
- Interactive resume, a live, filterable version of this document
- About, short bio and how to reach me

## Summary

<!--
  A professional summary in YOUR voice, the tone here is preserved when the
  app generates tailored resumes, so write the way you'd actually want to sound.

  The recruiter-facing summary the app generates is short and front-loads three
  things: years of experience, target job title, main skills (the first seven
  seconds of a resume read). Write the long version here; the app distills it.

  Avoid AI-tells: no em/en dashes ("—" / "–"), no "blend of X, Y, and Z", no
  "passion for meaningful impact". Sound like a person, not a brochure.

  Minimum: 2 sentences. Recommended: 3 to 5 sentences (about 80 to 120 words).
-->

Write 3 to 5 sentences about who you are professionally: your focus, your depth,
the kind of impact you've had. Plain, specific, your own voice.

## Career goals

<!--
  Where you want to go next and what you're optimizing for. This sharpens job
  ranking, postings that move you toward these goals score higher.
  Minimum: 1 to 2 sentences. Recommended: a short paragraph (about 50 to 150 words).
-->

What you want from your next role and the next few years. Be honest about
direction, title growth, a domain shift, more (or less) management, etc.

## Looking for

<!--
  Concrete attributes of a role you'd take. Used directly in ranking.
  Minimum: a few bullets. Recommended: cover comp, location/remote, company
  stage/size, domains, role scope.
-->

- Target titles: e.g. Staff / Principal Frontend Engineer
- Location / remote: e.g. Remote (US), or Hybrid in <city>
- Compensation floor: e.g. $X base
- Company stage/size: e.g. Series B to D, 50 to 500 people
- Domains of interest: e.g. developer tools, fintech, climate

## Avoiding

<!--
  Deal-breakers, what would make you pass on a role. Used to down-rank.
  Minimum: optional (you can skip this section). Recommended: a few bullets.
-->

- e.g. On-call-heavy roles
- e.g. Industries you won't work in
- e.g. Pure people-management with no IC work

## Working style

<!--
  How you work best, collaboration style, environment, what brings out your
  best work. Helps tailoring frame you for a given team.
  Minimum: optional. Recommended: 2 to 4 sentences.
-->

A few sentences on how you operate: autonomy vs. structure, async vs. sync,
how you like to collaborate, what environments you thrive in.

## Skills

<!--
  Your skills with a strength rating each. The app's internal scale is:
  Familiar < Proficient < Advanced < Expert.

  USE WHATEVER SCALE YOU ALREADY HAVE. If an interview rated you 0 to 9, or 1 to 5,
  or stars, or "years of experience",just write that. Don't reformat. The
  import maps any scale onto the four internal levels for you.

  Minimum: ~8 skills (ranking needs something to match). Recommended: 20 to 40.
  Be generous, every real skill is a keyword the matcher and tailored resumes
  can use.
-->

- React, Expert
- TypeScript, Expert
- Next.js, Advanced
- Design systems, Advanced
- Accessibility (WCAG), Proficient
- Node.js, Proficient
- GraphQL, Familiar

<!-- Other scales work too, e.g.:  "- Rust,6/9"  or  "- Figma,3 years" -->

## Experience

<!--
  Your work history, most recent first. Each role: a "### Title · Company"
  heading with dates, a one-line role summary, then accomplishment bullets.

  The one-line summary matters. Cover what the team did and what the role was
  set up to do. If you were promoted into this role, say so ("Promoted to Data
  Architect to lead a larger modernization of the legacy data warehouses").
  If the team owned something notable, name it ("Auto Loans team processing
  10M+ loans"). The generated resume uses this as the role's context line.

  Bullets follow the Challenge / Action / Result frame: what was wrong, what
  you did, what changed. Show the from-to so the result is meaningful
  ("near real-time data pipelines replacing legacy end-of-day reconciliation"
  beats "30-minute data freshness" on its own). One or two solid quantified
  anchors per role is the goal, a number on every line reads as fabricated.

  Brag where it's earned. Fastest promotion, awards, marks of distinction,
  named recognitions, call them out. The resume is a marketing document, not
  a humility exercise. If the bank gave you the "Run the Engine" award, the
  resume will say so.

  If a role had a clear tech stack or tool set, list it at the end of the role
  so it can become a "Tech Stack:" sub-bullet on the resume.

  Minimum per role: 2 bullets. Recommended: 4 to 6 bullets. Cover every relevant
  role; older/less-relevant ones can be shorter.
-->

### Senior Frontend Engineer · Example Co · 2022 to Present

One line on the team and what this role was set up to do. Note any promotion
context. Note any award or distinction that anchors the role.

- Accomplishment framed Challenge / Action / Result, with a from-to where you
  have one.
- Another accomplishment, what was broken, what you did, what changed.
- Another. Keep each to one tight sentence.

Tech stack: React, TypeScript, Next.js, Node.js, PostgreSQL.

### Frontend Engineer · Earlier Co · 2019 to 2022

One line of role context.

- Accomplishment.
- Accomplishment.

Tech stack: React, Redux, Webpack.

## Education

<!--
  Degrees, bootcamps, certifications. Each: "### Credential · Institution · years".

  The notes line is where specializations, GPA, honors, and clubs/activities go
 ,all of them. The generated resume reads this and surfaces it under the
  degree.

  GPA: if you include one, always format it to two decimal places ("3.40", not
  "3.4"; "3.62" stays "3.62"). The generator enforces this regardless, but
  writing it that way here keeps things consistent.

  Don't forget clubs and teams, Judo team, debate team, fraternity council,
  research lab, they signal range and personality.

  Minimum: optional. Recommended: list what you have, with notes.
-->

### B.S. Computer Science · Some University · 2015 to 2019

GPA: 3.62/4.00. Specializations: Database Design, AI/Machine Learning.
Member of the Judo Team. Graduated top 25% while working full-time as a developer.

## Achievements

<!--
  Standalone wins outside of work history, awards, certifications, talks,
  open-source, notable side projects.
  Minimum: optional. Recommended: a handful of bullets if you have them.
-->

- e.g. Speaker, SomeConf 2024,"Talk title"
- e.g. Maintainer of <open-source project>
- e.g. <Award or certification>

## For fun

<!--
  One short line of personal interests, hobbies, and side pursuits. This is
  the line that humanizes you on the resume and the cover letter.

  Be specific. "Beekeeping, with a focus on Caucasian honey bees" is
  memorable; "beekeeping" is generic. Most people don't know there are
  different kinds of honey bees, so the specificity does the work. The
  weirder, nerdier, or more uncommon the better, as long as it's true.

  Minimum: optional. Recommended: one specific line.
-->

Beekeeping (Caucasian honey bees). Building home-lab Kubernetes clusters.
Sci-fi novels, currently working through Dennis E. Taylor.

## Links

<!--
  Anything you'd put on a resume or hand a recruiter.
  Minimum: optional. Recommended: LinkedIn + GitHub + portfolio/site.
-->

- LinkedIn: https://linkedin.com/in/you
- GitHub: https://github.com/you
- Portfolio: https://you.example.com
