# Security Policy

## Reporting a vulnerability

Please report security issues **privately** — do not open a public issue for
them.

Use GitHub's private vulnerability reporting: open the **Security** tab of this
repository and click **Report a vulnerability**. That creates a private
advisory visible only to you and the maintainer.

Please include:

- a description of the issue and its impact,
- steps to reproduce, and
- the affected version or commit.

Expect an initial response within a few days. Next Job Spy is a personal-scale
project, so please allow reasonable time for a fix before any public
disclosure.

## Supported versions

Next Job Spy is pre-1.0 and ships from `master`. Fixes land on the latest
`master`; there are no separately maintained release branches.

## Scope and threat model

Next Job Spy is **local-first**: it runs on your own machine, stores all data
in a local SQLite file, and makes AI calls by shelling out to the Claude Code
CLI you already have installed. There is no hosted service, no account, and no
telemetry.

Reports are most useful when they concern:

- handling of the local database or profile data,
- the job-source fetchers (they make outbound HTTP requests),
- the API route handlers, or
- how the app invokes the Claude Code CLI.

Issues that require an attacker to already have local access to your machine
and user account are generally considered out of scope.
