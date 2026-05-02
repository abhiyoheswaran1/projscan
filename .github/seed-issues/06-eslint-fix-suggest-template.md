# Add a fix-suggest template for `eslint-*` issues

**Difficulty:** small · **Scope:** ~25 LOC + tests · **Template to copy:** existing entries in `src/core/fixSuggest.ts`

## What

`projscan_fix_suggest` already has hand-tuned templates for ~12 issue families (unused-dependency, cycle-detected, etc.). The `eslint-*` family currently falls through to the generic severity-anchored fallback, which is correct but bland. Add a tailored template that gives the agent a more useful instruction.

## Where

- `src/core/fixSuggest.ts` — append a new template entry to the `TEMPLATES` array, before the fallback. Match by `i.id.startsWith('eslint-')`.
- `tests/core/fixSuggest.test.ts` — add a `describe('eslint template', …)` test asserting the new template renders with the rule id and a non-generic instruction

## How

Look up how existing templates work (e.g. the `dep-risk-*` entry around line 95 of `fixSuggest.ts`). The eslint template should:

1. Pull the rule name out of the issue id (e.g. `eslint-no-unused-vars` → `no-unused-vars`)
2. Headline: "ESLint rule failed: `<rule-name>`"
3. Why: explain that ESLint rules represent codified team agreement; failing one means either the code is wrong OR the rule needs adjustment.
4. Instruction: tell the agent to either (a) fix the violation per the rule's docs, (b) `eslint-disable-next-line` with a comment explaining why the local exception is justified, or (c) propose a config change in `eslint.config.js` if the rule itself is wrong for the project. Reference the eslint docs URL pattern.
5. Optional `references`: `https://eslint.org/docs/latest/rules/<rule-name>` so the agent can fetch the rule docs if needed.

## Done condition

- New test in `fixSuggest.test.ts` that constructs a synthetic `eslint-no-unused-vars` issue and checks the rendered headline + instruction
- `npm test` and `npm run lint` clean

## Why this is a good first issue

Self-contained: one new entry in an existing array, one new test in an existing file. Zero risk of breaking the rest of the system. Good way to learn the fix-suggest pattern.
