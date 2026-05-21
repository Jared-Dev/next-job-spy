#!/usr/bin/env node
/**
 * Dependency-license gate. Reads `pnpm licenses list --json` from stdin and
 * checks every license against license-policy.json:
 *
 *   - a license on the deny list       -> fail (incompatible)
 *   - a license on neither list (new!) -> fail, asking you to classify it
 *   - a license on the allow list      -> pass
 *
 * Packages listed in `allowPackages` are exempt — e.g. a first-party SDK that
 * ships without a standard SPDX license field.
 *
 * Run it with:  pnpm check-licenses
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const policy = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../license-policy.json', import.meta.url)),
    'utf8',
  ),
);
const allow = new Set(policy.allow ?? []);
const deny = new Set(policy.deny ?? []);
const allowPackages = policy.allowPackages ?? [];

const isExempt = (name) =>
  allowPackages.some(
    (prefix) => name === prefix || name.startsWith(`${prefix}-`),
  );

let tree;
try {
  tree = JSON.parse(readFileSync(0, 'utf8'));
} catch (error) {
  console.error('Could not parse `pnpm licenses list --json` output from stdin.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const denied = [];
const unclassified = [];

for (const [license, packages] of Object.entries(tree)) {
  const names = packages
    .map((entry) => entry.name)
    .filter((name) => !isExempt(name));
  if (names.length === 0) continue;
  if (deny.has(license)) denied.push({ license, names });
  else if (!allow.has(license)) unclassified.push({ license, names });
}

const describe = ({ license, names }) => {
  const head = names.slice(0, 8).join(', ');
  const rest = names.length > 8 ? ` (+${names.length - 8} more)` : '';
  return `  ${license}\n    ${head}${rest}`;
};

if (denied.length === 0 && unclassified.length === 0) {
  console.log('OK — every dependency license is classified and allowed.');
  process.exit(0);
}

if (denied.length > 0) {
  console.error('Denied licenses found in the dependency tree:');
  console.error(denied.map(describe).join('\n'));
}
if (unclassified.length > 0) {
  console.error(
    '\nUnclassified licenses — add each to "allow" or "deny" in license-policy.json:',
  );
  console.error(unclassified.map(describe).join('\n'));
}
process.exit(1);
