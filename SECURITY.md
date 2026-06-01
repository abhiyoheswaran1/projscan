# Security Policy

## Reporting a vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Email vulnerability reports to support@baseframelabs.com with:

- affected projscan version
- operating system and Node.js version
- steps to reproduce
- impact you believe the issue has
- whether the report includes secret material or private repository data

We will acknowledge reports as soon as practical and will coordinate a fix, disclosure notes, and release timing based on severity.

## Supported versions

Security fixes target the latest published npm version of `projscan`. Older versions may receive guidance, but we do not promise backports unless a maintainer explicitly says so in the advisory.

## Scope

In scope:

- vulnerabilities in the `projscan` CLI, MCP server, local plugin loader, generated GitHub Action templates, and packaged runtime artifacts
- cases where projscan unintentionally reads, exposes, uploads, or persists sensitive local data
- supply-chain or package-integrity issues in the published npm package

Out of scope:

- vulnerabilities in a user's repository that projscan reports
- issues caused only by untrusted local plugins enabled through `PROJSCAN_PLUGINS_PREVIEW=1`
- npm, Git, or operating-system behavior outside projscan's control
- social engineering, spam, or denial-of-service reports without a concrete projscan defect

## Safe harbor

Good-faith testing is welcome when it avoids harm, privacy violations, data destruction, service disruption, and access to systems or data you do not own. Stop testing and contact us if you reach sensitive data.

## Security contact and brand note

Baseframe Labs is the umbrella brand for this product family. It is not currently a formed legal entity. Please do not address legal notices to Baseframe Labs with any corporate designator.
