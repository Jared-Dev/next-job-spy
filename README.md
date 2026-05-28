# Next Job Spy

An AI-powered job-search co-pilot that runs entirely on your machine. It discovers job postings across boards, scores them against your profile, and generates ATS-optimized resumes tailored to each role, powered by your existing Claude subscription instead of a separate, metered API bill.

## The name

**Next Job Spy** is three ideas in three words:

- **Next**, built with Next.js, and pointed at finding your *next* job.
- **Job Spy**, it does reconnaissance on the job market for you: watching boards, pulling postings, sizing each one up against who you are.

A spy for your next job, built with Next. That's the whole pitch.

## Why this exists

Job searching is a grind of repetitive, low-joy work: trawl a dozen job boards, read postings that don't fit, rewrite your resume for the ones that do, keep track of what you sent where. It's exactly the kind of work an AI agent should absorb.

[AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk) proved the agent approach works, it got real traction before being archived in April 2026, but it was a Python/Selenium tool: brittle, awkward to run, and not something you'd enjoy extending. Next Job Spy is a rebuild of that idea as an app a frontend developer would actually want to live in and hack on.

Two convictions shape it:

**Your job search is personal, it should run on your machine.** Your career history, the roles you're eyeing, the resumes you're generating: none of that needs to live in someone else's cloud. Next Job Spy is local-first. Every byte sits in a SQLite file in the project directory. No account, no signup, no telemetry.

**You shouldn't pay twice for Claude.** Anyone interested in a tool like this almost certainly already pays for Claude Pro or Max. Making them *also* set up pay-as-you-go Anthropic API billing is both friction and double-paying. So Next Job Spy routes every AI call through the Claude Code CLI you've already authenticated, ranking, resume tailoring, and cover letters all run inside the Claude plan you already pay for, with no separate metered API account. What you can do is bounded by the usage limits Anthropic sets for your subscription tier, not by a second bill.

## Goals

- **Aggregate**, pull job postings from multiple boards into one searchable, de-duplicated list.
- **Triage**, score every posting against your actual profile so your attention goes to real fits, not noise.
- **Tailor**, generate genuinely good, ATS-safe resumes customized to each posting, from one canonical profile you maintain.
- **Refine conversationally**, nudge a generated resume with plain language ("trim to one page", "lead with metrics") instead of hand-editing text.
- **Stay yours**, local-first storage, JSON export/import, no lock-in.
- **No second bill**, AI runs on your existing Claude subscription, within whatever usage limits Anthropic applies to your plan, instead of a separate metered API account.
- **(Later) apply**, drive the application submission itself.

## How AI auth works

Next Job Spy doesn't talk to the Anthropic API directly. It shells out to the **Claude Code CLI** installed on your machine, authenticated with your Claude Pro/Max subscription. There's no API key to manage and no separate per-token bill.

What you can get done, how many jobs you rank, how many resumes you tailor, functions within the usage limits Anthropic places on your subscription tier. The app drives Anthropic's Agent SDK, and Agent SDK usage draws on your plan's allowance for it; heavy use can run up against your plan's limits or call for a higher tier. It's the same subscription you already pay for, just not unlimited, and metered by Anthropic, not by us.

An optional API key fallback can be set in `/settings` for when your plan's allowance is exhausted; it's stored in the local SQLite database and otherwise unused.

## Quick start

```bash
# 1. Make sure Claude Code is installed and signed in with your subscription
claude login

# 2. Install and run (this project uses pnpm)
corepack enable pnpm
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The `/settings` page confirms AI runs on your Claude subscription, no API key required.

### First run

1. **`/profile`**, fill in identity, summary, work history, skills, achievements. This is your single source of truth.
2. **`/sources`**, add Greenhouse / Lever / RemoteOK / We Work Remotely sources (pick from curated lists or add custom). Hit **Refresh all**.
3. **`/jobs`**, postings land here. Filter by status, country, remote, fit. Hit **Rank unranked** to score them against your profile.
4. **`/jobs/<id>`**, on a posting you like, **Generate** a tailored resume, then **Refine** it with quick-action chips.
5. **Print view** opens a clean, ATS-safe, PDF-ready page, Cmd/Ctrl+P → Save as PDF.

## What's built

- **Profile**, sectioned editor (identity, links, summary, work history, education, skills, achievements). Resumes are generated *from* this; you never hand-maintain resume variants.
- **Sources**, Greenhouse, Lever, RemoteOK, We Work Remotely. Multi-pick curated boards or add custom ones. "Refresh all" runs in parallel and de-dupes on `(source, sourceId)`. Optional auto-refresh on a timer.
- **Jobs**, virtualized list (handles thousands of rows smoothly), filters for status / source / remote / country / min fit score. Auto-fetches on first visit when sources exist but the list is empty.
- **Country inference**, every posting gets a best-effort country code from its location string, so you can filter to US-only (or anywhere else).
- **Ranking**, score unranked jobs against your profile in batches via Claude Haiku. Gated until your profile has enough signal to make scoring meaningful.
- **Tailor**, per-job template selection (auto-suggested from profile + JD), generation with prompt-cache markers, conversational refinement, version history with pinning.
- **Print**, `/resume/[artifactId]/print` renders selectable, ATS-safe HTML with each template's own print CSS. The browser's print dialog produces the PDF, no rasterization, real text.
- **Token transparency**, token estimates before a call, exact input/output/cached-read counts stamped on each artifact after. No dollar figures anywhere (see below).
- **Design preview**, `/preview` (or ⌘K → "Design preview") shows every UI element with mock data.

### Deferred

- **Auto-apply**, Playwright worker that fills and submits applications.
- **Analytics**, application funnel + email-based response detection.
- HN "Who's Hiring" as a source; section-targeted refinement; streaming AI output.

## Token stewardship

Your plan's usage allowance is finite, so the tokens spent are yours to spend well. Principles baked in:

- **Prompt caching**, profile and template instructions are sent with cache markers, so repeat calls against the same profile get the cached-input discount.
- **Right model per task**, Haiku for ranking and template tie-breaks, Sonnet for tailoring and cover letters.
- **Tight per-route token ceilings**, rank, cover letter, and tailored resume each cap their output.
- **Client-side dedup cache**, generating with identical inputs returns the cached artifact and spends nothing.
- **Tokens only, never dollars.** The UI shows token counts, estimates before a call, exact `usage` figures after. It deliberately shows no dollar amounts: your Claude subscription dashboard is the one authoritative source for usage and billing.
- **No silent retries**, a failed call surfaces an error; you re-trigger deliberately.

## Stack

- **Next.js 16**, App Router, Turbopack, Server Actions
- **Mantine 9**, AppShell, forms, modals, notifications, spotlight
- **Drizzle ORM + better-sqlite3**, local storage at `./data/db.sqlite`
- **Claude Agent SDK**, AI calls via the Claude Code CLI / your subscription
- **TanStack Virtual**, windowed rendering for large job lists
- **Zod**, schema-driven validation throughout

## Conventions

Code shape is enforced by ESLint; violations fail the build.

- **No `../` imports**, sibling (`./`) or alias (`@/`) only.
- **One interface, type, or enum per file**, file name matching the declaration.
- **Prefixed type-shaped declarations**, `IFoo` interfaces, `TFoo` types, `EFoo` enums.
- **Interfaces over type aliases** unless type-only features are needed.
- **String-backed enums** for closed string sets, no inline literal unions.
- **Folders are the deletion unit**, a feature can be removed by deleting its folder.

## Layout

```text
app/
  api/
    ai/{rank, tailor-resume, refine-resume, cover-letter}/route.ts
    sources/[id]/route.ts              # Stateless source fetch
  jobs/{page,[id]/page}.tsx
  r/[artifactId]/print/page.tsx        # Print view (no app chrome)
  {sources, profile, settings, preview}/page.tsx
  page.tsx                             # Dashboard
components/
  generate/  jobs/  profile/  settings/  sources/  shell/  ui/
lib/
  ai/        invokeClaudeAgent, parseJsonFromAgent, pricing, usage, prompts
  jobs/      sources/{greenhouse, lever, remoteok, wwr}/  registry, ingest,
             inferCountry, refreshAllSources, useAutoRefresh
  resume/    templates/{icTechnical, leader, generalist}/  selectTemplate
  storage/
    local/   # SQLite adapter + sqlite/ + actions/
    types/   # Shared types, one declaration per file
  profile/   isProfileMeaningful
  theme.ts
```

## Notes

- **AI calls go through the Claude Code CLI**, no third-party services, no API key required for normal operation.
- **`data/` and `.claude/settings.local.json` are gitignored.**
- **Resumes are outputs, not inputs**, your profile is the source of truth; per-job resumes are generated from it.

## License

Next Job Spy is open source under the [GNU AGPL-3.0](./LICENSE). You're free to
use, study, modify, and share it. Note the AGPL's network clause: if you run a
modified version as a service others can use over a network, you must offer
those users the modified source.

Contributions are accepted under a Contributor License Agreement, see
[CONTRIBUTING.md](./CONTRIBUTING.md#contributor-license-agreement).

## Acknowledgments

Inspired by [AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk) (archived April 2026), the right idea, and the reason this rebuild exists.
