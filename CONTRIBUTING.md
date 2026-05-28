# Contributing to Next Job Spy

Thanks for your interest in contributing. Next Job Spy is a local-first,
AI-powered job-search co-pilot, see the [README](./README.md) for what it is
and why it exists. This guide covers how to work in the codebase.

## Getting set up

Prerequisites:

- **Node.js 22.13+** and **pnpm**. This project uses pnpm, `npm` and `yarn`
  installs fail fast via a `preinstall` guard. Node bundles Corepack, so
  `corepack enable pnpm` is all you need. (pnpm 11 itself requires Node 22.13+.)
- **Claude Code CLI**, installed and signed in (`claude login`). All AI calls
  route through it on your Claude subscription, there's no API key path for
  normal development.

Then:

```bash
git clone <your-fork>
cd next-job-spy
corepack enable pnpm
pnpm install
pnpm dev
```

Open <http://localhost:3000>. The [README quick start](./README.md#quick-start)
walks through first-run setup (profile, sources, ranking, tailoring).

## Code conventions

These are **enforced by ESLint**, a violation fails the build, so it's worth
reading before you write code. They're a little unusual; the goal is a
codebase that's easy to navigate and easy to delete from.

- **No `../` imports.** Use a sibling import (`./thing`) or the `@/` alias
  (`@/lib/...`). Never reach up the tree with `../`.
- **One interface, type, or enum per file.** The file name matches the
  declaration: `IProfile.ts` exports `interface IProfile`, `TFormValues.ts`
  exports `type TFormValues`, `EJobStatus.ts` exports `enum EJobStatus`.
- **Prefix type-shaped declarations**, `I` for interfaces, `T` for types,
  `E` for enums.
- **Prefer `interface` over `type`** unless you need type-only features
  (unions, mapped types, conditionals).
- **String-backed enums** for any closed set of strings, no inline string
  literal unions (`'a' | 'b'`).
- **Folders are the deletion unit.** Related files live together so a feature
  can be removed by deleting one folder. Job sources and resume templates are
  the clearest examples.

## Dependencies

Keep the dependency tree small, prefer a little first-party code over a new
package. When a dependency does earn its place, its **license** matters: Next
Job Spy is open source under the GNU AGPL-3.0, and a closed-source hosted
version may follow. A strong-copyleft (GPL / AGPL) dependency could not be
included in that closed version, so a new dependency must fall in the allowed
set below.

- **Allowed, permissive.** Add freely: MIT, ISC, BSD-2-Clause, BSD-3-Clause,
  Apache-2.0, 0BSD, Unlicense, CC0-1.0.
- **Allowed only as an unmodified dependency, weak copyleft.** LGPL (2.1 /
  3.0) and MPL-2.0 are fine to *depend on*; do not vendor, fork, or modify
  their source within this repo.
- **Never add, breaks the dual-license model.** Strong copyleft (GPL-2.0,
  GPL-3.0, AGPL-3.0), fine in the open-source build, but it cannot ship in the
  closed-source hosted version. Likewise source-available or non-commercial
  licenses (SSPL, BSL / BUSL, Elastic-2.0, Commons Clause, "non-commercial"
  Creative Commons, and similar), and any package with no license or one marked
  "all rights reserved".

If a package you need is licensed as anything other than the permissive set,
**open an issue before adding it**, license review is far easier up front than
after a PR is built. Call out every new dependency, and its license, in your
PR description.

CI runs `pnpm check-licenses`, which checks every dependency license against
[`license-policy.json`](./license-policy.json). A license that lands in neither
the allow nor the deny list fails the build until you classify it there, so a
new, unreviewed license can't slip in silently.

## Quality gates

Before opening a pull request, both of these must pass:

```bash
pnpm lint     # ESLint, convention + correctness rules
pnpm build    # type-check + production build
```

`pnpm build` runs the TypeScript check and will fail on type errors or
lint-rule violations. Keep it green.

A GitHub Actions workflow runs both on every pull request, a red check blocks
the merge. Running them locally first is just faster than waiting on CI.

## Project structure

The [README layout section](./README.md#layout) maps the tree. Key ideas:

- `app/`,Next.js routes (pages + API route handlers).
- `components/`,Mantine UI, grouped by feature area.
- `lib/`,non-UI logic: `ai/`, `jobs/`, `resume/`, `storage/`, `profile/`.
- `lib/storage/types/`,shared types, one declaration per file.

## Common contributions

### Adding a job source

Each source is a self-contained, deletable folder under `lib/jobs/sources/`.
To add one (say, `acme`):

1. Add a value to `ESourceId` (`lib/storage/types/ESourceId.ts`).
2. Create `lib/jobs/sources/acme/`:
   - `types/IAcmeJob.ts`,the raw shape the source's API returns.
   - `fetch.ts`,calls the source's public API.
   - `normalize.ts`,maps a raw job to `IJob` (set `country` via
     `inferCountry`, `status` to `EJobStatus.New`).
   - `index.ts`,exports an `IJobSource` (id, label, description,
     `paramFields`, `fetch`). Add `knownOptions` to a param to populate the
     curated picklist in the Add Source modal.
3. Register it in `lib/jobs/registry.ts`.

No other file needs to change, the `/sources` UI and `/api/sources/[id]`
route handler pick it up from the registry.

### Adding a resume template

Templates live under `lib/resume/templates/`, one folder each. A template
exports its system prompt and print CSS. Add an `ETemplateId` value and
register the template so the selector and tailoring routes can use it.

## Contributor License Agreement

Before your first contribution can be merged, you'll need to accept Next Job
Spy's Contributor License Agreement (CLA). It's the standard, unmodified
[Harmony CLA](https://www.harmonyagreements.org/), the same agreement many
open-core projects use.

**Why it exists.** Next Job Spy is open source under the GNU AGPL-3.0, and a
closed-source hosted version may follow. The CLA lets the project include your
contribution in both. You keep full ownership of your work and the same right
to use your own code; you grant the project a broad license to it.
The full text is in [`cla/cla.md`](./cla/cla.md).

**How to accept it.** Open a pull request as normal. A bot will comment with a
one-line statement to reply with; posting that comment records your acceptance
against your GitHub account, once, for all future PRs. The CLA status check
must be green before a PR can merge.

If you're contributing on behalf of a company, your employer accepts the
[Entity CLA](./cla/entity.odt) instead.

### Contributing code you don't fully own

Only submit code you wrote yourself, or that you otherwise have the right to
contribute under the project's license. In particular:

- **If you're employed as a developer,** your employment contract may give your
  employer rights over code you write, sometimes even on personal time. If
  that applies, have your employer accept the [Entity CLA](./cla/entity.odt),
  or get their written sign-off, before contributing.
- **Don't paste in code from another project, a forum answer, or an AI tool**
  unless its license clearly permits it and is compatible. If a change includes
  any third-party code, say so in the PR description and name the source and
  its license.
- **If you're under 18,** a parent or guardian needs to accept the CLA for you.

When in doubt, ask in the pull request before investing time, it's much easier
to sort out up front.

## Pull requests

- Keep PRs focused, one feature or fix per PR.
- Write a clear title and a description of **what** changed and **why**.
- Open PRs against the default branch (`master`).
- Make sure `npm run lint` and `npm run build` pass.
- Accept the CLA when the bot prompts (see above), required before merge.

## Reporting bugs and requesting features

Open a GitHub issue. For bugs, include steps to reproduce, what you expected,
and what happened, plus your OS and Node version. For features, describe the
problem you're trying to solve, not just the solution you have in mind.
