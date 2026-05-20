<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Dependencies and their licenses

Before adding any npm dependency, check its license. Next Job Spy is open
source under the GNU AGPL-3.0 and may later ship a closed-source hosted
version — a strong-copyleft (GPL / AGPL) dependency could not go into that
closed version, and a bad dependency is painful to remove once code depends on
it.

- **Allowed — permissive.** Add freely: MIT, ISC, BSD-2-Clause, BSD-3-Clause,
  Apache-2.0, 0BSD, Unlicense, CC0-1.0.
- **Allowed only as an unmodified dependency — weak copyleft.** LGPL (2.1 /
  3.0) and MPL-2.0: fine to depend on, but never vendor, fork, or modify their
  source inside this repo.
- **Never add.** Strong copyleft (GPL-2.0, GPL-3.0, AGPL-3.0); source-available
  or non-commercial licenses (SSPL, BSL / BUSL, Elastic-2.0, Commons Clause,
  "non-commercial" Creative Commons); and any package with no license or one
  marked "all rights reserved".

If a package you need is licensed as anything other than the permissive set,
stop and raise it with the maintainer — do not add it on your own judgement.
Prefer a small amount of first-party code over a new dependency whenever that
is reasonable.
