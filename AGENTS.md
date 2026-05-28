<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes, APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Package manager

This project uses **pnpm**. A `preinstall` guard (`only-allow`) makes `npm` and
`yarn` installs fail, use `pnpm` for every install, script, and dependency
change. The pnpm version is pinned in `package.json` (`packageManager`); the
build-script allowlist and `minimumReleaseAge` supply-chain policy live in
`pnpm-workspace.yaml`. A native dependency must be added to `allowBuilds` there.

## Cross-platform support

The project must run on Windows, macOS, and Linux. Before finishing any change
that touches scripts, paths, or process invocation, check that nothing you
added is shell- or OS-specific:

- **Env vars in `package.json` scripts.** `FOO=bar next dev` works in bash but
  fails on Windows `cmd`. Use `cross-env` (add it as a devDep) for any script
  that needs an inline env var, or read from `.env.local` / `process.env`
  instead. Same for `&&` vs `;`,prefer `&&` (works everywhere) or split
  into separate scripts.
- **Paths.** Always `path.join` / `path.resolve`; never hardcode `/` or `\`,
  never assume `/tmp`, `/usr`, `C:\`, or `~`. Use `os.tmpdir()` and
  `os.homedir()` when needed.
- **Shebangs and `.sh` scripts.** If you add a script the project invokes
  directly (not via `node`), it won't run on Windows. Invoke through `node`
  in `package.json` instead, the way `check-licenses` already does.
- **Native dependencies.** Confirm prebuilt binaries exist for win32-x64,
  darwin-x64/arm64, and linux-x64/arm64 (glibc). If a package only ships
  source and requires a C/C++ toolchain, raise it with the maintainer before
  adding, Windows contributors will hit build failures.
- **Platform-specific subpackages.** If a dep ships per-platform optional
  packages (like `@anthropic-ai/claude-agent-sdk-*`), make sure every
  supported triple is present in `pnpm-workspace.yaml`'s
  `minimumReleaseAgeExclude` list so fresh installs don't stall.

## Dependencies and their licenses

Before adding any dependency, check its license. Next Job Spy is open
source under the GNU AGPL-3.0 and may later ship a closed-source hosted
version, a strong-copyleft (GPL / AGPL) dependency could not go into that
closed version, and a bad dependency is painful to remove once code depends on
it.

- **Allowed, permissive.** Add freely: MIT, ISC, BSD-2-Clause, BSD-3-Clause,
  Apache-2.0, 0BSD, Unlicense, CC0-1.0.
- **Allowed only as an unmodified dependency, weak copyleft.** LGPL (2.1 /
  3.0) and MPL-2.0: fine to depend on, but never vendor, fork, or modify their
  source inside this repo.
- **Never add.** Strong copyleft (GPL-2.0, GPL-3.0, AGPL-3.0); source-available
  or non-commercial licenses (SSPL, BSL / BUSL, Elastic-2.0, Commons Clause,
  "non-commercial" Creative Commons); and any package with no license or one
  marked "all rights reserved".

If a package you need is licensed as anything other than the permissive set,
stop and raise it with the maintainer, do not add it on your own judgement.
Prefer a small amount of first-party code over a new dependency whenever that
is reasonable.

## Adding a dependency

Before finishing any change that adds a package, you must:

1. **License**, if it introduces a license not already in
   `license-policy.json`, classify it there: a clearly-permissive license in
   `allow`, a copyleft or source-available one in `deny`. Anything genuinely
   ambiguous, stop and ask the maintainer; do not self-approve it. The
   `check-licenses` CI gate fails on any unclassified license.
2. **Native build scripts**, if the package compiles or runs an install
   script, add it to `allowBuilds` in `pnpm-workspace.yaml`, or pnpm skips its
   build and the package will not work.
3. **Install with `pnpm`** so `pnpm-lock.yaml` updates. Never `npm` / `yarn`.
4. **Verify**, `pnpm check-licenses`, `pnpm lint`, and `pnpm build` must all
   pass before you are done.
