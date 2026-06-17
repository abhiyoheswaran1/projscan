# Personas And Research Notes

This file records the working personas used for projscan product decisions. Treat
them as a review tool, not a replacement for measured feedback from real PRs.

## Current Research Inputs

- Stack Overflow reports high AI-tool interest with low trust: more than 84% of
  2025 respondents used or planned to use AI tools, while only 29% said they
  trust AI tools. Source:
  https://stackoverflow.blog/2026/02/18/closing-the-developer-ai-trust-gap/
- Anthropic describes the 2026 engineering role as agent orchestration,
  quality evaluation, strategic decomposition, and stakeholder fit. Source:
  https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf
- Agentic code review research finds human reviewers have higher suggestion
  adoption rates than AI agents, and AI agent suggestions can increase code size
  and complexity when adopted. Source: https://arxiv.org/html/2603.15911v1
- Anthropic's MCP guidance says large tool surfaces consume context and cost;
  agents work better when they load only the tool definitions and results they
  need. Source: https://www.anthropic.com/engineering/code-execution-with-mcp
- DevOps.com coverage of Sonar survey data reports daily AI coding tool usage,
  low trust in generated code, security concerns, and review burden. Source:
  https://devops.com/survey-sees-wider-adoption-of-ai-coding-tools-creating-more-devops-challenges/

## Personas

### Agent-Orchestrating Senior Engineer

This engineer uses Codex, Claude Code, Cursor, or another agent to move several
small changes through a repo. They need the next safe command, proof that the
agent respected repo boundaries, and short handoffs that do not add review work.

Decision rule: favor features that reduce review uncertainty, expose exact proof
commands, and keep agent output compact.

### Platform And Release Owner

This reviewer owns CI, release gates, dependency policy, and developer workflow.
They need local evidence that an agent-generated change can be reviewed, rolled
back, and repeated without relying on a single agent transcript.

Decision rule: favor repeatable AgentLoopKit and projscan evidence over broad
claims about productivity.

### Security-Conscious Reviewer

This reviewer worries about source upload, env-file leakage, dependency drift,
and AI-generated code that looks plausible but skips trust boundaries. They need
visible local-only defaults and a way to separate runtime risk from dev-tooling
risk.

Decision rule: favor local-first commands, explicit trust boundaries, and
runtime-vs-dev verification.

### OSS Maintainer Evaluating MCP Adoption

This maintainer tries projscan as an MCP or CLI tool in an existing repository.
They need the first useful result quickly, with no cloud account, no invasive
setup, and no noisy false positives that force them to learn internals first.

Decision rule: favor first-run clarity, low-noise findings, and one reversible
setup step at a time.

## Decision Loop

For each slice:

1. Pick the persona with the most urgent blocked workflow.
2. Use current repo evidence first: `projscan route`, `projscan start`,
   `projscan bug-hunt`, `projscan privacy-check`, and AgentLoopKit gates.
3. Apply the Ponytail ladder: remove scope, use stdlib or existing config,
   use installed dependencies, write one line, then add the minimum new code.
4. Record the proof command before editing.
5. Run a post-implementation delete-list review for code, docs, and config.

## First Slice Decision

Selected persona: Platform And Release Owner.

Reason: installing AgentLoopKit made the repo workflow repeatable, but
`projscan bug-hunt` immediately flagged `agentloopkit` as an unused dev
dependency. The dependency is intentional because agents invoke its CLI through
`npm exec agentloop -- ...`; no source import should be added just to satisfy the
unused-dependency analyzer.

Smallest fix: add `unused-dependency-agentloopkit` to `.projscanrc.json`
`disableRules`, matching the existing tree-sitter CLI-use allowlist pattern.

Proof command:

```bash
npm exec projscan -- doctor --format json
```

## Ponytail Review

Delete-list after this slice:

- Do not add a source import of `agentloopkit`; it is a CLI tool, not runtime
  code.
- Do not change the unused-dependency analyzer for one intentional tool
  dependency; `.projscanrc.json` already supports exact rule disables.
- Do not add another dependency, script wrapper, or custom runner for
  AgentLoopKit. `npm exec agentloop -- ...` is enough.
- Do not expand this slice into release prep, CI workflow edits, or public API
  changes.

Kept change: one config allowlist entry and this decision note.

## Second Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: `projscan understand --view verify` reported unrelated analyzer tests as
direct evidence for `.agentflight/`. That path is a local evidence directory, and
claiming arbitrary test coverage creates false confidence for reviewers.

Smallest fix: keep the existing filename-based matcher, but prevent
directory-like paths from producing an empty match token. Preserve normal source
matching such as `src/config.ts` -> `tests/config.test.ts`.

Proof commands:

```bash
npm run test -- tests/core/understand.test.ts
npm exec projscan -- understand --view verify --format json
```

## Ponytail Review: Direct-Test Matching

Delete-list after this slice:

- Do not redesign direct-test discovery or add ownership metadata in the bugfix.
- Do not add a dependency for path matching; Node's `path` helpers are enough.
- Do not change the understand report schema.
- Do not broaden this into hotspot refactoring or full test-suite diagnosis.

Kept change: a small token guard in `src/core/understand.ts`, two focused tests,
and this decision note.

## Third Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: `projscan review --format json` returned "No structural changes" when
`base` and `head` resolved to the same commit, even with dirty local source
changes. Agent workflows often ask for review before committing, so this hid the
exact work reviewers needed to evaluate.

Smallest fix: keep the fast identical-ref review result only for clean
worktrees. If the worktree has staged, unstaged, or untracked files, use the
existing review graph comparison against a clean base worktree.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "reviews dirty worktree changes when base and head resolve to the same commit"
npm run test -- tests/core/review.test.ts -t "returns ok verdict with no changes between identical refs"
npm exec projscan -- review --format json
```

## Ponytail Review: Dirty-Worktree Review

Delete-list after this slice:

- Do not add a new `review` CLI flag; current-change review should work by
  default for local agent handoff.
- Do not duplicate graph-diff logic; use the existing base worktree path.
- Do not change the review schema or preflight policy in this slice.
- Do not run the full slow review suite as the proof gate when two targeted
  tests prove the changed branch.

Kept change: one worktree-clean guard, one regression test for dirty same-ref
review, and one preservation test for clean same-ref review.

## Fourth Slice Decision

Selected persona: Platform And Release Owner.

Reason: `projscan bug-hunt` should keep release-scale preflight warnings
visible, but those warnings are manual sign-off gates rather than concrete code
defects. Reviewer wording needs to route the action without overstating the
defect signal.

Smallest fix: keep the existing queue and schema, but label release-only
bug-hunt queues as manual sign-off actions and title the release finding as a
review sign-off.

Proof command:

```bash
npm run test -- tests/core/bugHunt.test.ts -t "bug hunt orders preflight fallback files by review usefulness"
```

## Ponytail Review: Release Sign-Off Wording

Delete-list after this slice:

- Do not remove release-scale preflight findings from `fixQueue`; they remain
  actionable handoff gates.
- Do not add a new verdict or schema field for one wording problem.
- Do not change review or preflight gate semantics.
- Do not add another CLI flag to choose strict vs sign-off language.

Kept change: one release-specific title, one release-only summary branch, one
focused regression assertion, and this decision note.

## Fifth Slice Decision

Selected persona: Platform And Release Owner.

Reason: evidence packs are the reviewer-facing release artifact. If bug-hunt
calls a release-scale queue a manual sign-off action, the evidence pack should
not re-label the same queue as generic fix targets.

Smallest fix: reuse the existing bug-hunt summary as the signal and change only
the artifact evidence label.

Proof command:

```bash
npm run test -- tests/core/releaseEvidence.test.ts -t "evidence pack labels release-scale bug-hunt queues as sign-off actions"
```

## Ponytail Review: Evidence-Pack Queue Label

Delete-list after this slice:

- Do not add a new evidence-pack schema field for wording.
- Do not change verdict calibration or approval policy.
- Do not recompute preflight or bug-hunt state inside the artifact formatter.
- Do not broaden this into release comment restructuring.

Kept change: one label helper, one public-boundary regression test, and this
decision note.

## Sixth Slice Decision

Selected persona: Platform And Release Owner.

Reason: release-train is the planning view a release owner reads before bug-hunt
and evidence-pack output. Its 2.4.x success criteria should not imply that every
bug-hunt queue entry is a code fix now that release-scale gates can be manual
sign-off actions.

Smallest fix: keep the same release-train schema and line, but rename the
success criterion to the first prioritized bug-hunt action.

Proof command:

```bash
npm run test -- tests/core/releaseTrain.test.ts -t "release train describes bug-hunt proof as prioritized actions"
```

## Ponytail Review: Release-Train Action Wording

Delete-list after this slice:

- Do not add a new release-train field for action type.
- Do not change release line ordering or readiness verdicts.
- Do not touch bug-hunt, preflight, or evidence-pack semantics again.
- Do not expand this into release roadmap restructuring.

Kept change: one success-criterion string, one public JSON regression test, one
guide sentence, and this decision note.

## Seventh Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: an engineer using `projscan start`, MCP tools, and CLI help needs the
same mental model across surfaces. Since bug-hunt can return manual sign-off
actions as well as concrete fixes, public descriptions should say action queue
while the machine schema remains stable.

Smallest fix: update public descriptions and docs only; keep `fixQueue` as the
compatibility field.

Proof command:

```bash
npm run test -- tests/mcp/releaseTrainBugHunt.test.ts tests/core/releaseTrain.test.ts tests/core/intentRouter.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "bug_hunt|bug-hunt|prioritized action|release train describes"
```

## Ponytail Review: Public Bug-Hunt Wording

Delete-list after this slice:

- Do not rename the `fixQueue` JSON property.
- Do not add aliases or migration wrappers for a wording-only change.
- Do not change ranking, preflight, or evidence-pack behavior.
- Do not expand this into a release readiness redesign.

Kept change: public strings, focused string-level regressions, docs, and this
persona note.

## Eighth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: release sign-off output is a review queue. If package metadata and
source changes are buried behind README or local config paths, the reviewer
loses time before seeing the files that explain dependency and code risk.

Smallest fix: keep the same finding, schema, and summary, but sort fallback
files by review usefulness before appending agent runtime paths.

Proof command:

```bash
npm run test -- tests/core/bugHunt.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "preflight fallback files"
```

## Ponytail Review: Sign-Off File Routing

Delete-list after this slice:

- Do not rename `fixQueue`.
- Do not change bug-hunt ranking or verdicts.
- Do not rewrite preflight changed-file detection.
- Do not add configuration for ordering until a real team needs it.

Kept change: one deterministic sort helper, two focused expectations, and this
persona note.

## Ninth Slice Decision

Selected persona: OSS Maintainer Evaluating MCP Adoption.

Reason: maintainers often test tools in monorepos with untracked workspace
packages. If a sign-off queue says `packages/` or buries
`packages/api/package.json`, the reviewer cannot quickly tell which package is
driving release risk.

Smallest fix: ask git for full untracked file paths and replace the branch-heavy
rank helper with ordered path-pattern tables.

Proof commands:

```bash
npm run test -- tests/utils/changedFiles.test.ts -t "expands untracked nested directories"
npm run test -- tests/core/bugHunt.test.ts tests/cli/releaseTrainBugHunt.test.ts -t "preflight fallback files"
```

## Ponytail Review: Nested File Context

Delete-list after this slice:

- Do not add a custom filesystem walker for untracked directories.
- Do not make ordering configurable yet.
- Do not change preflight verdicts, summaries, or schemas.
- Do not add monorepo-specific special cases outside the path ranking table.

Kept change: one git flag, one ordered pattern table, focused regressions, and
this persona note.

## Tenth Slice Decision

Selected persona: Platform And Release Owner.

Reason: raw `projscan review` output is the first gate many release owners and
agents see. Bug-hunt already translates broad release-scale blocks into manual
sign-off actions, but review summaries still looked like generic block reasons
even when there were no concrete cycle, risky-function, contract, taint, or
dataflow defects.

Smallest fix: keep the verdict and schema unchanged, and add one summary line
only when the block is caused by broad release-scale risk signals.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "labels release-scale review blocks as manual sign-off"
npm run test -- tests/core/review.test.ts -t "reports exported symbol contract changes"
```

## Ponytail Review: Review Sign-Off Summary

Delete-list after this slice:

- Do not add a new review JSON field for action type.
- Do not change risk thresholds, dependency gates, or verdict values.
- Do not hide existing max-risk or dependency summary lines.
- Do not label concrete contract, cycle, risky-function, taint, or dataflow
  defects as manual-only sign-off.

Kept change: one additive summary line, two focused review regressions, and this
persona note.

## Eleventh Slice Decision

Selected persona: Platform And Release Owner.

Reason: bug-hunt consumes review summaries. After review started saying
`Manual release sign-off required`, bug-hunt release findings repeated that
instruction in the wrapper text. The signal was correct, but the repeated
wording made the handoff look noisier than the underlying risk.

Smallest fix: keep the release sign-off action and existing review details, but
omit the extra wrapper sentence when the embedded review summary already carries
manual sign-off guidance.

Proof command:

```bash
npm run test -- tests/core/bugHunt.test.ts -t "orders preflight fallback files by review usefulness"
```

## Ponytail Review: Release Sign-Off Dedupe

Delete-list after this slice:

- Do not add another bug-hunt field for wording provenance.
- Do not change preflight verdicts, bug-hunt ranking, or file ordering.
- Do not remove manual sign-off guidance from release-scale findings.
- Do not rewrite the release-scale evidence model for one duplicate sentence.

Kept change: one conditional tail, one string-count regression, and this persona
note.

## Twelfth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: a senior engineer or agent lead will ask broad product-direction
questions such as "what should we build next?" before selecting a slice. The
router already picked workplan, but only because of the weak word `next`, which
made Mission Control look less certain than the product decision actually was.

Smallest fix: add guarded product-planning keywords to the workplan route. These
keywords count only when the prompt combines planning language with product,
feature, or build language, so quick-win improvement prompts stay on bug-hunt.

Proof commands:

```bash
npm run test -- tests/core/intentRouter.test.ts -t "product-planning|quick-win"
npm run test -- tests/core/start.test.ts -t "product-planning"
```

## Ponytail Review: Product-Planning Routing

Delete-list after this slice:

- Do not add LLM intent inference.
- Do not change route result schema, command names, or MCP tool names.
- Do not steal quick-win, low-risk, five-minute, or beginner task prompts from
  bug-hunt.
- Do not redesign workflow mode inference for one routing confidence problem.

Kept change: guarded keyword vocabulary, two focused regressions, public docs,
and this persona note.

## Thirteenth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: after product-planning prompts routed to workplan, Mission Control still
used the default `before_edit` mode. That produced an orientation workplan
instead of a prioritized product-planning pass, which is weaker than the user's
"what should we build next?" intent.

Smallest fix: infer `bug_hunt` mode only for high-confidence workplan routes
that combine planning and product/build keywords, then pass the resolved mode
into the routed workplan action.

Proof command:

```bash
npm run test -- tests/core/start.test.ts -t "build-next|feature-placement|intent routes but workflow mode defaults|explicit mode overrides product planning"
```

## Ponytail Review: Build-Next Mode Inference

Delete-list after this slice:

- Do not change the route schema or workplan schema.
- Do not infer bug-hunt mode for impact, feature-placement, release, or merge
  questions.
- Do not duplicate mode inference in command rendering.
- Do not add broad keyword matching outside the guarded product-planning route.

Kept change: one route predicate, one internal mode argument, focused start
regressions, public docs, and this persona note.

## Fourteenth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: after build-next prompts selected the correct `bug_hunt` workplan, the
done criteria still said only that the next task had a verification command.
That was accurate but too weak for product planning; agents need to know whether
to accept, defer, or split the product slice.

Smallest fix: keep schema and routing stable, but add product-planning success
criteria when the route is the guarded build/product workplan route.

Proof command:

```bash
npm run test -- tests/core/start.test.ts -t "build-next|feature-placement|intent routes but workflow mode defaults|explicit mode overrides product planning"
```

## Ponytail Review: Product-Planning Criteria

Delete-list after this slice:

- Do not change the workplan schema or generate new task types.
- Do not alter impact, feature-placement, release, or merge success criteria.
- Do not remove broad proof commands in this slice.
- Do not add another route predicate when the existing product-planning predicate
  already defines the boundary.

Reviewer edge case: explicit mode overrides must not receive bug-hunt-specific
criteria unless the resolved mode is `bug_hunt`.

Kept change: one success-criteria branch with a resolved-mode guard, focused
regression expectations, guide wording, and this persona note.

## Fifteenth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: "what should we improve next" is a broad product/team planning prompt.
Before this slice it matched only generic `next` wording and produced a
before-edit workplan, leaving the agent without a ranked action queue.

Smallest fix: treat `improve` or `improvement` plus `next` as a bug-hunt
opportunity context. Do not make all `next` or all `task` wording bug-hunt
signals.

Proof commands:

```bash
npm run test -- tests/core/intentRouter.test.ts -t "improve next|quick-win|product-planning"
npm run test -- tests/core/start.test.ts -t "improve next|quick-win|build-next"
```

## Ponytail Review: Broad Improve-Next Routing

Delete-list after this slice:

- Do not add a new route entry for improvement planning.
- Do not add `next` to the general bug-hunt opportunity token list.
- Do not steal test, performance, release, dependency, or safety intents.
- Do not change bug-hunt ranking or workplan generation.

Reviewer edge case: release, dependency, and safety improve-next variants must
not fall through to generic `next` workplan/agent-brief matches after the
bug-hunt shortcut is suppressed.

Kept change: one guarded opportunity-context line, one protected improve-next
context guard, focused router/start regressions, guide wording, and this persona
note.

## Sixteenth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: the user gave an explicit standing instruction to continue bounded work
autonomously, but Mission Control still told agents to stop before starting any
next slice. That friction is useful for normal sessions, but it conflicts with
an intentional autonomous continuation loop.

Smallest fix: detect autonomous continuation wording in `start --intent` and
remove only `next_slice` from the review gate's blocked actions. Keep release,
publish, deploy, push, merge, and version-bump approval gates unchanged.

Proof commands:

```bash
npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"
npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"
```

## Ponytail Review: Autonomous Continuation Gate

Delete-list after this slice:

- Do not add a new CLI flag, config file, or required JSON field for autonomy.
- Do not relax release, publish, deploy, push, merge, or version-bump gates.
- Do not change normal Mission Control intents; they still block `next_slice`
  until approval.
- Do not broaden this into workflow routing, AgentLoop task management, or
  release prep.

Reviewer edge case: the user's misspelling `autonomosly` should still follow
the autonomous continuation policy.

Kept change: one intent predicate, one review-gate policy branch, focused start
regressions, live CLI proof, and this persona note.

## Seventeenth Slice Decision

Selected persona: Platform And Release Owner.

Reason: `src/core/start.ts` remained the highest-risk hotspot after several
Mission Control improvements. Review-gate policy and markdown rendering are a
cohesive unit that release owners care about, so separating it lowers review
risk without changing behavior.

Smallest fix: move review-gate construction, proof shaping, and review-decision
formatting into `src/core/startReviewGate.ts`. Keep runbook/task-card assembly
in `start.ts`.

Proof commands:

```bash
npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"
npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"
```

## Ponytail Review: Review-Gate Helper Extraction

Delete-list after this slice:

- Do not split all Mission Control code at once.
- Do not change wording, schema, or review-gate policy while extracting.
- Do not add a helper class, dependency, or configuration layer.
- Do not move runbook/task-card rendering until there is a separate reason.

Kept change: one focused helper module, a smaller `start.ts`, existing
characterization tests, and this persona note.

## Eighteenth Slice Decision

Selected persona: Platform And Release Owner.

Reason: after review-gate extraction, `src/core/start.ts` still mixed
orchestration with runbook and task-card Markdown rendering. Release owners need
those artifacts stable, but they do not need that rendering embedded in the
routing module.

Smallest fix: move runbook and task-card construction/rendering into
`src/core/startRunbook.ts`. Keep execution-plan and resume state-machine logic
in `start.ts`.

Proof commands:

```bash
npm run test -- tests/core/start.test.ts -t "start exposes a Mission Control task card for MCP and JSON clients"
npm run test -- tests/core/start.test.ts -t "allows autonomous continuation intents to keep bounded slice work unblocked"
```

## Ponytail Review: Runbook Helper Extraction

Delete-list after this slice:

- Do not move the execution-plan or resume state machine in the same slice.
- Do not change task-card or runbook wording while extracting.
- Do not add renderer classes, templates, dependencies, or config.
- Do not touch CLI start command wiring.

Kept change: one focused helper module, a smaller `start.ts`, existing
characterization tests, and this persona note.

## Nineteenth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: the CLI `start` command is the surface an agent actually uses during a
handoff. It should stay easy to audit: option dispatch in the command file,
bundle artifact generation in a focused helper, and no silent behavior drift in
the mission files agents depend on.

Smallest fix: move Mission Control bundle writing, proof-log scaffolding, and
mission/status/review script generation into `src/cli/commands/startMissionBundle.ts`.
Keep CLI option registration, shortcut index construction, and report-specific
selection helpers in `src/cli/commands/start.ts`.

Proof commands:

```bash
npm run test -- tests/cli/start.test.ts -t "writes a Mission Control bundle"
npm run test -- tests/cli/start.test.ts -t "Mission Control bundle as JSON"
npm run test -- tests/cli/start.test.ts
npm run typecheck
```

## Ponytail Review: CLI Mission Bundle Helper Extraction

Delete-list after this slice:

- Do not change save-mission artifact names, JSON shapes, script wording, or
  proof-log behavior while extracting.
- Do not move shortcut index or CLI option dispatch in the same slice.
- Do not introduce templates, classes, dependencies, or config.
- Do not change public CLI flags or bundle file permissions.

Reviewer edge case: `proof-logs/README.md` must still list the current cursor
command before remaining proof commands when `mission.sh` can log them.

Kept change: one focused CLI helper module, a smaller `start.ts`, existing
save-mission characterization tests, and this persona note.

## Twentieth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: after bundle extraction, `src/cli/commands/start.ts` still carried the
human console renderer. Agents need that output stable, but command dispatch
does not need to own every console section and formatting helper.

Smallest fix: move the human-readable `start` renderer into
`src/cli/commands/startConsole.ts`. Keep option dispatch, shortcut construction,
bundle writing, and JSON-only branches in `src/cli/commands/start.ts`.

Proof commands:

```bash
npm run test -- tests/cli/start.test.ts -t "start console"
npm run test -- tests/cli/start.test.ts
npm run typecheck
```

## Ponytail Review: CLI Start Console Renderer Extraction

Delete-list after this slice:

- Do not change CLI flags, shortcut behavior, JSON behavior, or bundle writing.
- Do not rewrite the command option dispatch cascade in this slice.
- Do not change console wording, ordering, colors, or section limits.
- Do not introduce renderer classes, templates, dependencies, or config.

Reviewer edge case: the console renderer receives the same ready proof commands
and reviewer replies selected by `start.ts`; it must not independently select a
different proof queue.

Kept change: one focused console helper module, a smaller `start.ts`, existing
console characterization tests, and this persona note.

## Twenty-First Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: `src/cli/commands/start.ts` should read like a command boundary. After
the renderer and bundle helpers moved out, the remaining risk was the
computed-report output dispatch cascade for JSON, shortcuts, bundles, and
Mission Control one-shot outputs.

Smallest fix: move computed-report output dispatch into
`src/cli/commands/startOutput.ts`. Keep option declarations, mode parsing, root
path selection, report computation, and top-level error handling in
`src/cli/commands/start.ts`.

Proof commands:

```bash
npm run test -- tests/cli/start.test.ts -t "next-command|next-tool-call|ready-tool-calls|proof-commands|checklist|resume-json|handoff-json|task-card|review-gate|review-policy|review-replies|runbook|mission-script|shortcuts|Mission Control bundle"
npm run test -- tests/cli/start.test.ts
npm run typecheck
```

## Ponytail Review: CLI Start Output Dispatch Extraction

Delete-list after this slice:

- Do not change flag names, commander option behavior, or format support.
- Do not change shortcut ordering, generated shortcut commands, JSON compactness,
  or bundle file contents.
- Do not change console rendering, bundle writing, or Mission Control schemas.
- Do not add dependencies, configuration, renderer classes, or templates.

Reviewer edge case: `--save-mission` must still run before the global JSON
branch so `--format json --save-mission` returns `{ "missionBundle": ... }`
instead of the full start report.

Kept change: one focused output-dispatch helper module, a much smaller
`start.ts`, existing shortcut/bundle characterization tests, and this persona
note.

## Twenty-Second Slice Decision

Selected persona: Maintainer Preparing Review.

Reason: `src/cli/index.ts` is the public executable boundary. It should be easy
for reviewers to prove that startup still registers the same commands in the
same order before argument parsing.

Smallest fix: move command registrar imports, ordering, and invocation into
`src/cli/registerCommands.ts`. Keep `src/cli/index.ts` as the executable
entrypoint that imports `program`, registers commands, and calls
`program.parse()`.

Proof commands:

```bash
npm run test -- tests/cli/registerCommands.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/cli/index.ts --format json
```

## Ponytail Review: CLI Command Registration Helper Extraction

Delete-list after this slice:

- Do not rename, drop, or reorder CLI command registrations.
- Do not move `program.parse()` out of the executable entrypoint.
- Do not change command flags, aliases, output formats, or help text.
- Do not add dependencies, dynamic imports, plugin loading, or command discovery.

Reviewer edge case: `registerRecipes()` must still run before
`registerFirstRun()`, and `registerHelp()` must remain last to preserve the
existing startup order.

Kept change: one focused registrar helper module, a tiny executable entrypoint,
a registrar-order characterization test, and this persona note.

## Twenty-Third Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control should route a plain-language request to the same
command and MCP args every time. Natural-language target parsing is a real
product capability, but it does not belong in the same file as report assembly,
review gates, runbooks, and execution-plan state.

Smallest fix: move target parsing, search-query normalization, semantic-graph
query shaping, placeholder checks, and shell quoting into
`src/core/startIntentTargets.ts`. Keep `computeStartReport` and action-plan
assembly in `src/core/start.ts`.

Proof commands:

```bash
npm run test -- tests/core/startIntentTargets.test.ts
npm run test -- tests/core/start.test.ts -t "search|impact|semantic graph|package|issue|auth token loader|rate limits|React Query|migrations|env var"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Mission Control Intent Target Parser Extraction

Delete-list after this slice:

- Do not change StartReport schema, Mission Control command wording, or MCP
  tool-call argument shapes.
- Do not add new parsing behavior while moving helpers.
- Do not duplicate parser helpers between `start.ts` and
  `startIntentTargets.ts`.
- Do not split the parser by domain in the same slice.

Reviewer edge case: search quoting must still escape `$`, backticks, double
quotes, and backslashes before producing `projscan search "..."`
commands.

Kept change: one focused parser helper module, direct parser characterization
tests, targeted `start` behavior tests, and this persona note.

## Twenty-Fourth Slice Decision

Selected persona: Maintainer Preparing Review.

Reason: `src/cli/commands/start.ts` is still the highest-priority scorecard
hotspot because of historical churn and single-owner risk, even after the large
output extraction. It should become a stable flag-registration boundary so
future behavior changes land in smaller, directly testable modules.

Smallest fix: move action execution, mode parsing, positive integer parsing,
report-computation wiring, and top-level error handling into
`src/cli/commands/startAction.ts`. Keep public flags and Commander registration
in `src/cli/commands/start.ts`.

Proof commands:

```bash
npm run test -- tests/cli/startAction.test.ts
npm run test -- tests/cli/start.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/cli/commands/start.ts --format json
```

## Ponytail Review: Start CLI Action Handler Extraction

Delete-list after this slice:

- Do not rename flags, change help text, or change supported `--mode` values.
- Do not change `computeStartReport` option names or `handleStartOutput`
  context shape.
- Do not change process-exit behavior for unsupported modes or command
  failures.
- Do not add dependencies, abstractions around Commander, or new output modes.

Reviewer edge case: `.action(runStartAction)` would be unsafe because Commander
passes extra arguments; keep the single-argument `runStartCommandAction`
wrapper.

Kept change: one focused action helper module, focused command-action tests, a
34-line command registration file, and this persona note.

## Twenty-Fifth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control success criteria are user-facing handoff text. They
drive what an agent believes is "done" before continuing, so that policy should
be directly testable instead of buried in the main `start.ts` orchestration
file.

Smallest fix: move success-criteria generation into
`src/core/startSuccessCriteria.ts`, keep wording and ordering stable, and reduce
the old branch tree into small resolver functions plus rule tables.

Proof commands:

```bash
npm run test -- tests/core/startSuccessCriteria.test.ts
npm run test -- tests/core/start.test.ts -t "successCriteria|Done When|build-next|auth token loader|npm scripts|local services|regression"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Mission Control Success Criteria Extraction

Delete-list after this slice:

- Do not change `StartReport` schema, success-criteria wording, or criteria
  ordering.
- Do not change intent routing, action-plan generation, proof commands,
  runbook rendering, or review-gate policy.
- Do not copy the large branch tree into a new module without reducing function
  complexity.
- Do not add dependencies, templates, or generic policy engines.

Reviewer edge case: `projscan_workplan` only gets product-planning criteria
when mode is `bug_hunt`, confidence is high, and both planning and product
keywords are present.

Kept change: one success-criteria module, resolver-level characterization
tests, targeted `start` behavior tests, and this persona note.

## Twenty-Sixth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control mode selection decides which workflow an autonomous
agent follows before it reads the rest of the handoff. That policy needs a
small, directly testable module because incorrect mode inference changes user
behavior even when the report schema is unchanged.

Smallest fix: move explicit mode handling, intent-based mode inference,
preflight/review/regression mode helpers, and routed-intent normalization into
`src/core/startMode.ts`. Keep action-plan and command rendering in
`src/core/start.ts`.

Proof commands:

```bash
npm run test -- tests/core/startMode.test.ts
npm run test -- tests/core/start.test.ts -t "infers|modeSource|modeReason|release workflows|safe to commit|what breaks|build-next|dataflow|regression"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Start Mode Resolution Extraction

Delete-list after this slice:

- Do not change `StartReport` schema, `modeSource`, `modeReason`, or routed
  intent object shape.
- Do not change route ranking, action-plan generation, proof commands,
  success criteria, review gates, runbooks, or CLI output.
- Do not add dependencies or a generic rule engine for mode inference.
- Do not combine the next action/command-generation extraction into this slice.

Reviewer edge case: mixed intents like "is it safe to commit and what breaks if
I rename the auth token loader" must still choose the impact route as primary
while using the preflight alternative to infer `before_commit`.

Kept change: one focused mode helper module, exact reason-text
characterization tests, targeted `start` behavior tests, and this persona note.

## Twenty-Seventh Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control route actions are the commands an agent actually runs
or hands to MCP. If those strings or args drift, the user experiences the
assistant as unreliable even when intent routing is correct.

Smallest fix: move route-specific action plans, arg shaping, command rendering,
and command-only intent classifiers into `src/core/startRouteActions.ts`. Keep
fallback selection, proof-command selection, success criteria, mode resolution,
and review gates in their existing modules.

Proof commands:

```bash
npm run test -- tests/core/startRouteActions.test.ts
npm run test -- tests/core/start.test.ts -t "primaryAction|readyActions|proofCommands|auth token loader|rate limits|React Query|migrations|env var|regression|safe to commit|PR comment|claim"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Start Route Action Rendering Extraction

Delete-list after this slice:

- Do not change route ranking, mode inference, success criteria, proof command
  selection, review gates, runbooks, or CLI output.
- Do not change user-facing command strings, action labels, placeholder names,
  shell escaping, or MCP tool-call arg shapes.
- Do not keep duplicate route-action helpers in `start.ts`.
- Do not add dependencies or generic command templating.

Reviewer edge case: freeform impact searches must still escape shell expansion
syntax before producing `projscan search "..."` commands.

Kept change: one route-action module, resolver-table arg and command rendering,
focused route command tests, targeted Mission Control behavior tests, and this
persona note.

## Twenty-Eighth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control resume state is what lets another agent or human pick
up work without rediscovering context. If cursor selection, checklist ordering,
or proof-tool-call parsing drifts, the product feels unreliable even when the
primary command is correct.

Smallest fix: move resume assembly, execution cursor selection, checklist
projection, follow-up projection, and proof command tool-call parsing into
`src/core/startResume.ts`. Keep route rendering, proof-command selection,
success criteria, review gates, and runbook rendering in their existing
modules.

Proof commands:

```bash
npm run test -- tests/core/startResume.test.ts
npm run test -- tests/core/start.test.ts -t "resume|checklist|execution|cursor|primaryAction|readyActions|proofCommands"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Start Resume State Extraction

Delete-list after this slice:

- Do not change Mission Control resume prompt text, checklist item ordering,
  cursor reason text, proof command filtering, or proof tool-call arg shapes.
- Do not change route rendering, mode inference, success criteria, review
  gates, runbooks, primary actions, ready actions, or proof-command selection.
- Do not keep duplicate resume/cursor helper implementations in `start.ts`.
- Do not introduce a new large or branch-heavy helper module while reducing
  `start.ts`.

Reviewer edge case: a ready search command that unlocks placeholder inputs
must still omit that current command from remaining proof while retaining the
follow-up input bindings and proof MCP tool calls.

Kept change: one resume-state module, cursor rule-table selection, focused
resume tests, targeted Mission Control integration tests, and this persona
note.

## Twenty-Ninth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control execution plans are the structured state that JSON,
MCP, runbooks, task cards, handoffs, and resume prompts all read from. The
phase graph needs one focused owner because a small dependency-wiring drift can
make the next agent run steps in the wrong order.

Smallest fix: move execution-plan construction, action-to-step conversion,
action readiness, placeholder extraction, proof-step projection, and summary
text into `src/core/startExecutionPlan.ts`. Keep resume/cursor selection in
`startResume.ts` and keep route rendering, success criteria, review gates, and
runbooks in their existing modules.

Proof commands:

```bash
npm run test -- tests/core/startExecutionPlan.test.ts
npm run test -- tests/core/start.test.ts -t "executionPlan|resume|handoff|runbook|primaryAction|readyActions|proofCommands"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Start Execution Plan Extraction

Delete-list after this slice:

- Do not change phase order, phase IDs, step IDs, currentPhase, cursor shape,
  or execution-plan summary text.
- Do not change ready-step unlocks, unresolved input dependsOn/unlocks,
  follow-up blockedBy/dependsOn, proof-step tool-call args, or done_when
  criteria.
- Do not change route selection, primary actions, ready actions, proof command
  selection, resume prompt text, success criteria, review gates, or runbooks.
- Do not keep duplicate execution-plan helper implementations in `start.ts`.

Reviewer edge case: the first ready search step must unlock both input steps,
while placeholder follow-ups remain blocked and depend on `ready-1` plus the
specific input they require.

Kept change: one execution-plan module, focused phase-graph tests, targeted
Mission Control integration tests, and this persona note.

## Thirtieth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Mission Control policy helpers decide what an agent sees as urgent,
runnable, blocked, and worth proving. Those strings and command lists need a
focused owner because they shape whether a handoff is trustworthy.

Smallest fix: move status/headline, why-now explanations, fallback action
selection, unresolved input instructions, guardrails, proof command selection,
workflow selection, risk conversion, action dedupe, and start summary text into
`src/core/startMissionPolicy.ts`. Keep route rendering, execution-plan
construction, resume state, success criteria, review gates, and runbook
rendering in their existing modules.

Proof commands:

```bash
npm run test -- tests/core/startMissionPolicy.test.ts
npm run test -- tests/core/start.test.ts -t "status|headline|whyNow|primaryAction|readyActions|proofCommands|guardrails|risk|summary"
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
```

## Ponytail Review: Start Mission Policy Extraction

Delete-list after this slice:

- Do not change Mission Control status, headline, whyNow text, action labels,
  unresolved input instructions, guardrail commands, proof-command
  filtering/order, workflow selection, risk IDs, or summary text.
- Do not change route ranking/rendering, mode resolution, execution-plan
  wiring, resume prompt text, success criteria, review gates, runbooks, or CLI
  output.
- Do not keep duplicate Mission Control policy helpers in `start.ts`.
- Do not add dependencies or a generic policy engine.

Reviewer edge case: placeholder impact follow-ups must still be excluded from
proof commands while the ready search command, preflight guardrail, verify
command, session hint, and workplan verification command stay ordered and
deduped.

Kept change: one Mission Control policy module, focused policy tests, targeted
Mission Control integration tests, and this persona note.

## Thirty-First Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Shortcut commands are the operational bridge between a start report and
the next agent action. They must stay predictable, copyable, and stable because
teams use them under review pressure.

Smallest fix: move shortcut index construction, start command shell quoting,
current/ready tool-call compaction, ready proof fallback, mission shortcut
options, and reviewer reply line formatting into
`src/cli/commands/startShortcuts.ts`. Keep output-mode dispatch, console
printing, mission bundle writing, and core Mission Control assembly in their
existing modules.

Proof commands:

```bash
npm run test -- tests/cli/startShortcuts.test.ts
npm run test -- tests/cli/start.test.ts -t "shortcuts|mission script|handoff prompt|ready tool calls"
npm run typecheck
npm run build
npm exec projscan -- file src/cli/commands/startOutput.ts --format json
```

## Ponytail Review: Start Shortcut Extraction

Delete-list after this slice:

- Do not change `projscan start` flags, shortcut IDs, labels, descriptions,
  command order, JSON shape, current command, current tool-call shape, or shell
  quoting.
- Do not change mission bundle file layout, Mission Control report generation,
  route selection, execution plans, review gate policy, or console output.
- Do not keep duplicate shortcut command builders in `startOutput.ts`.
- Do not add dependencies or a generic command-template engine.

Reviewer edge case: freeform intent text containing a single quote must still be
quoted as POSIX shell-safe text in every generated shortcut command.

Kept change: one shortcut helper module, focused shortcut tests, targeted CLI
integration tests, and this persona note.

## Thirty-Second Slice Decision

Selected persona: Staff Reviewer.

Reason: PR review console output is where a human reviewer sees why a change is
blocked, risky, or safe. It should be isolated from unrelated console report
formats so review output can evolve without dragging the whole reporter hotspot
along.

Smallest fix: move `reportReview` and its changed-file, cycle,
risky-function, dependency, verdict, summary, and unavailable-review helpers
into `src/reporters/consoleReviewReporter.ts`. Re-export `reportReview` from
`src/reporters/consoleReporter.ts` so callers keep the same public import.

Proof commands:

```bash
npm run test -- tests/reporters/consoleReviewReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleReviewReporter.ts --format json
```

## Ponytail Review: Console Review Reporter Extraction

Delete-list after this slice:

- Do not change review verdict labels, headings, summary bullets, section
  ordering, changed-file limits, cycle limits, risky-function limits,
  dependency-change formatting, delta signs, or unavailable-review wording.
- Do not change review computation, JSON reporter output, Markdown reporter
  output, CLI flags, package files, or `ReviewReport` schema.
- Do not break `reportReview` imports from `src/reporters/consoleReporter.ts`.
- Do not introduce a broad terminal rendering abstraction.

Reviewer edge case: changed-file output must keep null risk and null complexity
rendering as `-`, while positive CC deltas keep their plus sign.

Kept change: one review console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Thirty-Third Slice Decision

Selected persona: Staff Reviewer.

Reason: PR structural diff output is the reviewer’s quick map of what changed
at the API/import/complexity level. It deserves a focused renderer so the main
console reporter does not keep accumulating unrelated review surfaces.

Smallest fix: move `reportPrDiff` and its ref, file-total, added, removed,
modified-file, export/import, rename, and delta-sign helpers into
`src/reporters/consolePrDiffReporter.ts`. Re-export `reportPrDiff` from
`src/reporters/consoleReporter.ts` so callers keep the same public import.

Proof commands:

```bash
npm run test -- tests/reporters/consolePrDiffReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consolePrDiffReporter.ts --format json
```

## Ponytail Review: Console PR Diff Reporter Extraction

Delete-list after this slice:

- Do not change PR diff headings, unavailable output, base/head ref text, file
  total wording, added/removed/modified section order, export/import line
  labels, rename formatting, or delta sign formatting.
- Do not change structural diff computation, review rendering, JSON reporter
  output, Markdown reporter output, CLI flags, package files, or `PrDiffReport`
  schema.
- Do not break `reportPrDiff` imports from `src/reporters/consoleReporter.ts`.
- Do not introduce a broad terminal rendering abstraction.

Reviewer edge case: zero CC deltas must still render as `+0`, while zero
fan-in deltas stay omitted.

Kept change: one PR diff console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Thirty-Fourth Slice Decision

Selected persona: Agent-Orchestrating Senior Engineer.

Reason: Fix suggestions and issue explanations are agent instruction surfaces.
They need stable wording, wrapping, and verification text because another agent
may paste them directly into a task plan.

Smallest fix: move `reportFixSuggest`, `reportExplainIssue`, and their shared
line-wrapping helper into `src/reporters/consoleFixGuidanceReporter.ts`.
Re-export both reporter functions from `src/reporters/consoleReporter.ts` so
callers keep the same public import.

Proof commands:

```bash
npm run test -- tests/reporters/consoleFixGuidanceReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleFixGuidanceReporter.ts --format json
```

## Ponytail Review: Console Fix Guidance Reporter Extraction

Delete-list after this slice:

- Do not change Fix Suggestion or Issue Explanation headings, unavailable
  output, severity/category metadata, Why/Where/Action/Verify/Related files
  section names, excerpt formatting, related issue bullets, similar fix lines,
  suggested action text, or wrapping behavior.
- Do not change fix suggestion computation, issue explanation computation,
  Markdown reporter output, JSON reporter output, CLI flags, package files, or
  public `FixSuggestion`/`IssueExplanation` schemas.
- Do not break `reportFixSuggest` or `reportExplainIssue` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad terminal rendering abstraction.

Reviewer edge case: long instructions must still wrap at the same width while
single-line verification commands stay intact when under the limit.

Kept change: one fix guidance console reporter module, compatibility
re-exports, focused characterization tests, and this persona note.

## Thirty-Fifth Slice Decision

Selected persona: Staff Reviewer.

Reason: Impact output is used to decide blast radius before a change proceeds.
Its distance grouping and truncation behavior need to stay predictable while the
main console reporter gets smaller.

Smallest fix: move `reportImpact` and its target, symbol detail, definition
file, reachable summary, distance-grouping, and overflow helpers into
`src/reporters/consoleImpactReporter.ts`. Re-export `reportImpact` from
`src/reporters/consoleReporter.ts` so callers keep the same public import.

Proof commands:

```bash
npm run test -- tests/reporters/consoleImpactReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleImpactReporter.ts --format json
```

## Ponytail Review: Console Impact Reporter Extraction

Delete-list after this slice:

- Do not change Impact headings, unavailable output, target lines, symbol
  definition/caller summary, Defined in section, reachable count, truncation
  note, distance grouping, 50-item display limit, or no-reachable output.
- Do not change impact analysis, graph traversal, Markdown reporter output,
  JSON reporter output, CLI flags, package files, or public `ImpactReport`
  schema.
- Do not break `reportImpact` imports from `src/reporters/consoleReporter.ts`.
- Do not introduce a broad terminal rendering abstraction.

Reviewer edge case: reports with more than 50 reachable entries must still show
only the first 50 and then the exact overflow count.

Kept change: one impact console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Thirty-Sixth Slice Decision

Selected persona: Staff Reviewer.

Reason: Doctor health output is one of the first trust surfaces a user sees.
The extraction should reduce reviewer load without changing the score line,
issue grouping, stable-rule guidance, or next-command path.

Smallest fix: move `reportHealth`, `ReportHealthOptions`, and the health-only
section printers into `src/reporters/consoleHealthReporter.ts`. Re-export the
function and type from `src/reporters/consoleReporter.ts` so existing CLI and
external imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleHealthReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleHealthReporter.ts --format json
```

## Ponytail Review: Console Health Reporter Extraction

Delete-list after this slice:

- Do not change Project Health Report headings, score formatting, no-issue
  message, issue-count wording, scan-time line, issue detail lines, suggested
  action command, Recommendations block, Project Memory stable-rule tip, or
  Next best commands.
- Do not change score calculation, health issue detection, JSON reporter output,
  Markdown reporter output, SARIF/HTML reporter output, CLI flags, package
  files, or public `Issue` shape.
- Do not break `reportHealth` or `ReportHealthOptions` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a zero-issue health report must still return immediately
after the healthy message and must not print issue or next-command sections.

Kept change: one health console reporter module, compatibility re-exports,
focused characterization tests, and this persona note.

## Thirty-Seventh Slice Decision

Selected persona: Release Steward.

Reason: Dependency output is release-adjacent. It needs predictable package
totals, license summaries, installed-size evidence, and risk rows without
changing dependency analysis behavior.

Smallest fix: move `reportDependencies` and its dependency-only section
printers into `src/reporters/consoleDependencyReporter.ts`. Re-export the
function from `src/reporters/consoleReporter.ts` so existing imports stay
compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleDependencyReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleDependencyReporter.ts --format json
```

## Ponytail Review: Console Dependency Reporter Extraction

Delete-list after this slice:

- Do not change Dependency Report headings, package totals, sorted production
  dependency rows, 25-item truncation, License Summary fields, Installed
  Package Sizes fields, risk icons, risk row wording, or final blank line.
- Do not change dependency analysis, license detection, installed package-size
  calculation, JSON reporter output, Markdown reporter output, CLI flags,
  package files, lockfiles, or public `DependencyReport` shape.
- Do not break `reportDependencies` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad dependency reporting abstraction.

Reviewer edge case: dependency reports without licenses, sizes, production
dependencies, or risks must still print only the top totals section.

Kept change: one dependency console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Thirty-Eighth Slice Decision

Selected persona: Staff Reviewer.

Reason: Hotspot output directs where engineers spend refactor time. It needs to
stay stable while the console reporter gets smaller, especially for accepted
debt tags and the drill-down command.

Smallest fix: move `reportHotspots` and its hotspot-only section printers into
`src/reporters/consoleHotspotReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleHotspotReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleHotspotReporter.ts --format json
```

## Ponytail Review: Console Hotspot Reporter Extraction

Delete-list after this slice:

- Do not change Project Hotspots headings, unavailable warning, no-hotspots
  message, scanned commit wording, ranked file count wording, score formatting,
  proportional bar rendering, reason fallback, `[accepted]` tag, accepted
  legend, or `projscan file <file>` drill-down tip.
- Do not change hotspot scoring, ranking, Project Memory accepted-hotspot
  detection, JSON reporter output, Markdown reporter output, CLI flags,
  package files, lockfiles, or public `HotspotReport` shape.
- Do not break `reportHotspots` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a report with no hotspots must return after the healthy
message and scanned commit line, without printing the drill-down tip.

Kept change: one hotspot console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Thirty-Ninth Slice Decision

Selected persona: Release Steward.

Reason: Upgrade previews sit close to dependency and release decisions. They
need predictable drift metadata, breaking-change evidence, importer visibility,
and changelog excerpts while the reporter module gets smaller.

Smallest fix: move `reportUpgrade` and its upgrade-only section printers into
`src/reporters/consoleUpgradeReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleUpgradeReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleUpgradeReporter.ts --format json
```

## Ponytail Review: Console Upgrade Reporter Extraction

Delete-list after this slice:

- Do not change unavailable upgrade output, Upgrade Preview heading, declared
  version line, installed version line, drift line, breaking-marker heading,
  breaking-marker truncation, no-breaking message, importer heading, importer
  rows, 15-item importer truncation, no-importer message, changelog heading,
  40-line changelog truncation, or no-local-changelog message.
- Do not change upgrade preview computation, semver drift, registry behavior,
  JSON reporter output, Markdown reporter output, CLI flags, package files,
  lockfiles, or public `UpgradePreview` shape.
- Do not break `reportUpgrade` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad upgrade reporting framework.

Reviewer edge case: an unavailable preview must print only the unavailable
reason and must not print the Upgrade Preview heading or any section body.

Kept change: one upgrade console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Fortieth Slice Decision

Selected persona: Release Steward.

Reason: Outdated dependency output is one of the first release-readiness checks
a maintainer reads. It needs stable drift grouping, missing-package evidence,
and dev dependency labeling while the general console reporter keeps shrinking.

Smallest fix: move `reportOutdated` and its outdated-only section printers into
`src/reporters/consoleOutdatedReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleOutdatedReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleOutdatedReporter.ts --format json
```

## Ponytail Review: Console Outdated Reporter Extraction

Delete-list after this slice:

- Do not change unavailable outdated output, Outdated Packages heading,
  declared/drifted/not-installed summary wording, clean all-matched message,
  major/minor/patch headings, drift row formatting, dev dependency `[dev]`
  tag, Not installed heading, missing package rows, 10-item missing truncation,
  or blank-line behavior.
- Do not change outdated detection, semver drift computation, workspace
  scanning, JSON reporter output, Markdown reporter output, CLI flags, package
  files, lockfiles, or public `OutdatedReport` shape.
- Do not break `reportOutdated` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a report with only `same` or `unknown` installed packages
must still render the healthy all-matched message and return without drift or
missing sections.

Kept change: one outdated console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-First Slice Decision

Selected persona: Staff Reviewer.

Reason: Coupling output tells maintainers where architecture is tangled. It
needs stable totals, cycle rows, cross-package edge evidence, and fan-in/fan-out
tables while the general console reporter gets smaller.

Smallest fix: move `reportCoupling` and its coupling-only section printers into
`src/reporters/consoleCouplingReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleCouplingReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleCouplingReporter.ts --format json
```

## Ponytail Review: Console Coupling Reporter Extraction

Delete-list after this slice:

- Do not change Coupling + Cycles heading, no-files warning, graph totals
  wording, singular/plural wording, cross-package edge count wording, Import
  cycles heading, cycle row text, Cross-package edges heading, edge row
  formatting, 25-item edge truncation, Files table heading, table header, fan-in
  values, fan-out values, instability formatting, or blank-line behavior.
- Do not change coupling analysis, cycle detection, graph construction,
  package boundary detection, JSON reporter output, HTML reporter output, CLI
  flags, package files, lockfiles, or public `CouplingReport` shape.
- Do not break `reportCoupling` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a one-file graph with no cross-package edges must not print
cross-package wording, but it must still print the files table.

Kept change: one coupling console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-Second Slice Decision

Selected persona: First-Run Evaluator.

Reason: The project analysis report is the first broad summary many users read
after pointing ProjScan at a repository. It needs stable project metadata,
language visibility, structure rows, issue rows, and fix suggestions while the
general console reporter keeps shrinking.

Smallest fix: move `reportAnalysis` and its analysis-only section printers into
`src/reporters/consoleAnalysisReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleAnalysisReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleAnalysisReporter.ts --format json
```

## Ponytail Review: Console Analysis Reporter Extraction

Delete-list after this slice:

- Do not change ProjScan Project Report, Project, Languages, Structure, Issues,
  or Suggestions headings; project name, primary language, framework,
  package-manager, dependency, file, directory, or scan-time lines; language bar
  rendering; language sorting or 8-item limit; structure row formatting or
  12-item limit; issue icon/title rows; fixable suggestion rows; final
  `projscan fix` command text; or blank-line behavior.
- Do not change scanning, language detection, framework detection, dependency
  detection, issue detection, JSON reporter output, Markdown reporter output,
  CLI flags, package files, lockfiles, or public `AnalysisReport` shape.
- Do not break `reportAnalysis` imports from
  `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a report with no frameworks, unknown package manager, and
no dependency report must omit those optional project lines while still
rendering the rest of the project summary.

Kept change: one analysis console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-Third Slice Decision

Selected persona: Staff Reviewer.

Reason: Health diff output is review evidence. It needs stable score deltas,
issue-change lists, hotspot movement sections, truncation, and baseline
timestamps while the general console reporter keeps shrinking.

Smallest fix: move `reportDiff` and its diff-only section printers into
`src/reporters/consoleDiffReporter.ts`. Re-export the function from
`src/reporters/consoleReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleDiffReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleDiffReporter.ts --format json
```

## Ponytail Review: Console Diff Reporter Extraction

Delete-list after this slice:

- Do not change Health Diff or Hotspot Changes headings; score transition,
  grade transition, resolved issue, new issue, no-change issue, hotspot
  worsening, newly risky, improving, no-longer-tracked, or baseline timestamp
  wording; hotspot rose/appeared/fell 10-item limits; resolved hotspot 5-item
  limit; or blank-line behavior.
- Do not change baseline diff computation, score calculation, hotspot scoring,
  JSON reporter output, Markdown reporter output, CLI flags, package files,
  lockfiles, or public `DiffResult` shape.
- Do not break `reportDiff` imports from `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: hotspot diff sections must honor their existing truncation
limits independently: rose/appeared/fell show 10 rows, resolved shows 5 rows.

Kept change: one diff console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-Fourth Slice Decision

Selected persona: Staff Reviewer.

Reason: Markdown health diff output is portable review evidence. It needs stable
score deltas, issue-change sections, hotspot movement tables, and omission
behavior while the Markdown reporter starts shrinking.

Smallest fix: move `reportDiffMarkdown` and its diff-only section appenders into
`src/reporters/markdownDiffReporter.ts`. Re-export the function from
`src/reporters/markdownReporter.ts` so existing imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/markdownDiffReporter.test.ts
npm run test -- tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/markdownReporter.ts --format json
npm exec projscan -- file src/reporters/markdownDiffReporter.ts --format json
```

## Ponytail Review: Markdown Diff Reporter Extraction

Delete-list after this slice:

- Do not change `# Health Diff`, metric table headers, score row, grade row,
  positive/negative/zero score delta arrows, Resolved section, New Issues
  section, Hotspots Worsening table, Newly Risky Files table, Hotspots
  Improving table, or optional-section omission behavior.
- Do not change baseline diff computation, score calculation, hotspot scoring,
  console reporter output, JSON reporter output, CLI flags, package files,
  lockfiles, or public `DiffResult` shape.
- Do not break `reportDiffMarkdown` imports from
  `src/reporters/markdownReporter.ts`.
- Do not introduce a broad Markdown rendering framework.

Reviewer edge case: resolved hotspot deltas are intentionally not rendered in
Markdown today; the extraction must preserve that omission until a separate
product decision changes the report.

Kept change: one Markdown diff reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-Fifth Slice Decision

Selected persona: CI Maintainer.

Reason: CI console output is automation-facing. It needs stable PASS/FAIL
wording, score/grade text, threshold display, issue counts, and failure issue
rows while the general console reporter keeps shrinking.

Smallest fix: move `reportCi` into `src/reporters/consoleCiReporter.ts`.
Re-export the function from `src/reporters/consoleReporter.ts` so existing
imports stay compatible.

Proof commands:

```bash
npm run test -- tests/reporters/consoleCiReporter.test.ts
npm run test -- tests/reporters/consoleReporter.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/reporters/consoleReporter.ts --format json
npm exec projscan -- file src/reporters/consoleCiReporter.ts --format json
```

## Ponytail Review: Console CI Reporter Extraction

Delete-list after this slice:

- Do not change `projscan:` prefix, score/grade formatting, PASS/FAIL labels,
  error/warning/info count wording, threshold text, or issue row rendering when
  the report fails.
- Do not change score calculation, issue detection, CI CLI flags, JSON reporter
  output, Markdown reporter output, SARIF reporter output, package files,
  lockfiles, or public issue shapes.
- Do not break `reportCi` imports from `src/reporters/consoleReporter.ts`.
- Do not introduce a broad console rendering framework.

Reviewer edge case: a passing report must not print issue rows even when the
threshold is below the current score.

Kept change: one CI console reporter module, a compatibility re-export,
focused characterization tests, and this persona note.

## Forty-Sixth Slice Decision

Selected persona: Mission Operator.

Reason: `projscan start` is the command a working agent uses to decide the next
move. Mission-control output needs stable routed intent, action plan, proof
queue, runbook, task card, handoff prompt, and review gate wiring while the top
`start.ts` hotspot shrinks.

Smallest fix: move `buildMissionControl` and its private handoff prompt helpers
into `src/core/startMissionControl.ts`. Keep `computeStartReport` as the public
entry point from `src/core/start.ts`.

Proof commands:

```bash
npm run test -- tests/core/startMissionControl.test.ts
npm run test -- tests/core/start.test.ts
npm run test -- tests/mcp/start.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
npm exec projscan -- file src/core/startMissionControl.ts --format json
```

## Ponytail Review: Start Mission Control Extraction

Delete-list after this slice:

- Do not change `computeStartReport` public export, `StartReport` shape, routed
  intent selection, action plan ordering, proof command filtering, resume
  wording, runbook/task card sections, handoff prompt wording, or review gate
  decisions.
- Do not change CLI command files, MCP tool definitions, schemas, package files,
  lockfiles, mission outcome loading, workplan generation, quality scorecard
  generation, or success criteria semantics.
- Do not introduce a generic workflow orchestration framework.
- Do not leave mission-control-only helpers duplicated in `src/core/start.ts`.

Reviewer edge case: impact intent with a phrase target must still search first,
then expose symbol/file placeholder follow-ups, and the handoff/review gate must
use the resume-filtered proof queue.

Kept change: one internal mission-control builder module, a focused builder
test, existing core/MCP start coverage, and this persona note.

## Forty-Seventh Slice Decision

Selected persona: Session-Aware Agent.

Reason: `projscan start` must separate current Git/worktree evidence from
remembered session touches. Agents need that distinction to avoid treating old
session memory as current diff evidence, while still seeing useful coordination
hints before editing.

Smallest fix: move `buildStartRiskSources` and
`buildStartCoordinationHints` into `src/core/startEvidence.ts`. Keep
`computeStartReport` as the public start report entry point.

Proof commands:

```bash
npm run test -- tests/core/startEvidence.test.ts
npm run test -- tests/core/start.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
npm exec projscan -- file src/core/startEvidence.ts --format json
```

## Ponytail Review: Start Evidence Helpers Extraction

Delete-list after this slice:

- Do not change `StartReport.evidence.riskSources` shape, current-worktree
  fields, session-memory fields, 40-file truncation, session touch sorting, or
  remembered-session note text.
- Do not change current-worktree coordination hint wording, harness hint
  ordering/pass-through, preflight mode command selection, remembered-session
  hint wording, or remembered-session hint omission when there are no touches.
- Do not change `getChangedFiles`, session persistence, harness detection,
  preflight mode mapping, CLI command files, MCP tool definitions, schemas,
  package files, or lockfiles.
- Do not introduce a generic evidence orchestration framework.

Reviewer edge case: current worktree evidence and remembered session evidence
must stay visibly separate; a session touch can add a coordination hint, but it
must not be represented as a current changed file.

Kept change: one internal start evidence module, focused evidence tests for
session sorting/truncation/fallbacks and hint wording, existing core start
integration coverage, and this persona note.

## Forty-Eighth Slice Decision

Selected persona: Team Adoption Lead.

Reason: the adoption loop is product guidance, not start report orchestration.
It defines how a team turns projscan into PR muscle memory through evidence
packs, preflight, feedback, and dogfood loops. That content needs focused
coverage while `start.ts` continues shrinking.

Smallest fix: move `buildAdoptionLoop` into
`src/core/startAdoptionLoop.ts`. Keep `computeStartReport` as the public start
entry point and keep the adoption loop content unchanged.

Proof commands:

```bash
npm run test -- tests/core/startAdoptionLoop.test.ts
npm run test -- tests/core/start.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/core/start.ts --format json
npm exec projscan -- file src/core/startAdoptionLoop.ts --format json
```

## Ponytail Review: Start Adoption Loop Extraction

Delete-list after this slice:

- Do not change adoption loop cadence, why text, metric ids, metric labels,
  metric targets, metric commands, next command order, feedback command, or
  dogfood command examples.
- Do not change `computeStartReport`, `StartReport.adoptionLoop`, first-ten-
  minutes guidance, dogfood/trial activation logic, CLI command files, MCP tool
  definitions, schemas, package files, or lockfiles.
- Do not introduce a generic onboarding/adoption framework.
- Do not leave adoption-loop content duplicated in `src/core/start.ts`.

Reviewer edge case: dogfood command examples must keep both the multi-repo
feedback loop and the single local-repo loop, because they support different
validation workflows.

Kept change: one internal start adoption-loop module, focused content tests,
existing core start integration coverage, and this persona note.

## Forty-Ninth Slice Decision

Selected persona: Public API Maintainer.

Reason: `src/types.ts` is both a maintainability hotspot and the stable type
entry point used across the codebase. The next improvement must reduce file
gravity without making existing imports change or adding circular type
dependencies.

Smallest fix: move dependency-light type clusters into
`src/types/common.ts`, `src/types/hotspots.ts`, `src/types/inspection.ts`,
and `src/types/mcp.ts`. Keep `src/types.ts` as the public compatibility barrel
with type-only re-exports.

Proof commands:

```bash
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-type-modules.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/types.ts --format json
npm exec projscan -- file src/types/common.ts --format json
npm exec projscan -- file src/types/hotspots.ts --format json
npm exec projscan -- file src/types/inspection.ts --format json
npm exec projscan -- file src/types/mcp.ts --format json
```

## Ponytail Review: Public Type Leaf Module Extraction

Delete-list after this slice:

- Do not rename or remove `IssueSeverity`, `IssueLocation`, `Issue`,
  `ImportInfo`, `ExportInfo`, `AuthorShare`, `FileHotspot`,
  `FileInspection`, `FunctionDetail`, `ToolDeprecation`,
  `McpToolDefinition`, `McpPromptArgument`, `McpPromptDefinition`, or
  `McpResourceDefinition` from `src/types.ts`.
- Do not let leaf type modules import from `src/types.ts`.
- Do not change CLI output, MCP schemas, package exports, dependencies,
  lockfiles, docs, or start-command behavior in this slice.
- Do not extract `StartReport` or mission-control types until their dependency
  order can be handled without barrel cycles.

Reviewer edge case: a consumer importing `FileInspection` or
`McpToolDefinition` from `src/types.js` must still typecheck, while internal
leaf modules must remain usable directly for future decomposition work.

Kept change: four leaf type modules, a compatibility barrel, a compile-only
type probe, typecheck/build verification, and this persona note.

## Fiftieth Slice Decision

Selected persona: Public API Maintainer.

Reason: the top scan and analysis contracts are widely consumed by reporters,
CLI commands, MCP tools, and tests. They should leave `src/types.ts` only if
the existing public import path remains stable and each moved name is covered
by a compatibility compile probe.

Smallest fix: move scan/language/framework/dependency types into
`src/types/scanning.ts`, and file explanation/architecture/analysis/health
types into `src/types/analysis.ts`. Keep `src/types.ts` as the public
compatibility barrel with type-only re-exports.

Proof commands:

```bash
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-scan-analysis-types.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/types.ts --format json
npm exec projscan -- file src/types/scanning.ts --format json
npm exec projscan -- file src/types/analysis.ts --format json
```

## Ponytail Review: Public Scan Analysis Type Extraction

Delete-list after this slice:

- Do not rename or remove `ScanResult`, `ScanBoundary`, `FileEntry`,
  `DirectoryNode`, `LanguageBreakdown`, `LanguageStat`, `FrameworkResult`,
  `DetectedFramework`, `DependencyReport`, `DependencyLicenseEntry`,
  `DependencyLicenseSummary`, `DependencySizeEntry`, `DependencySizeSummary`,
  `DependencyRisk`, `FileExplanation`, `ArchitectureLayer`,
  `AnalysisReport`, or `HealthScore` from `src/types.ts`.
- Do not let `src/types/scanning.ts` or `src/types/analysis.ts` import from
  `src/types.ts`.
- Do not change scan output, dependency report output, health score grades,
  CLI output, MCP schemas, package exports, dependencies, lockfiles, docs, or
  start-command behavior in this slice.
- Do not extract preflight, workplan, StartReport, review, graph, dataflow, or
  config types until their dependency order can be handled without barrel
  cycles.

Reviewer edge case: `HealthScore` remains referenced by many later public
contracts in `src/types.ts`, so the barrel must import it directly from
`src/types/analysis.ts` as a type and still re-export it for consumers.

Kept change: two leaf type modules, a compatibility barrel, a compile-only
type probe covering every moved type, typecheck/build verification, and this
persona note.

## Fifty-First Slice Decision

Selected persona: Fix Workflow Maintainer.

Reason: fix suggestion and issue explanation contracts are copied into agent
plans, CLI output, Markdown output, and JSON output. The type split must keep
that public contract stable while reducing the central type barrel.

Smallest fix: move `FixSuggestion`, `IssueExplanation`, `Fix`, and
`FixResult` into `src/types/fixes.ts`. Keep `src/types.ts` as the public
compatibility barrel with type-only re-exports.

Proof commands:

```bash
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-fix-types.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/types.ts --format json
npm exec projscan -- file src/types/fixes.ts --format json
```

## Ponytail Review: Public Fix Type Extraction

Delete-list after this slice:

- Do not rename or remove `FixSuggestion`, `IssueExplanation`, `Fix`, or
  `FixResult` from `src/types.ts`.
- Do not let `src/types/fixes.ts` import from `src/types.ts`.
- Do not change fix suggestion fields, issue explanation fields, fix apply
  function shape, fix result success/error shape, CLI output, reporter output,
  MCP schemas, package exports, dependencies, lockfiles, README, guide docs, or
  start-command behavior in this slice.
- Do not extract preflight, workplan, StartReport, review, graph, dataflow, or
  config types until their dependency order can be handled without barrel
  cycles.

Reviewer edge case: a consumer importing `FixResult` from `src/types.js` must
still see the nested `Fix` shape, including `apply(rootPath): Promise<void>`.

Kept change: one leaf fix type module, a compatibility barrel, a compile-only
type probe covering every moved fix type, typecheck/build verification, and
this persona note.

## Fifty-Second Slice Decision

Selected persona: Review Intelligence Maintainer.

Reason: semantic graph and dataflow contracts feed review, preflight, agent
briefs, plugins, issue engine, and CLI output. The split must make those
contracts easier to find without weakening the public compatibility barrel.

Smallest fix: move `GraphEvidenceSummary`, semantic graph types, and dataflow
types into `src/types/graph.ts`. Keep `src/types.ts` as the public
compatibility barrel with type-only re-exports.

Proof commands:

```bash
npx tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --types node tests/types/public-graph-types.test.ts
npm run typecheck
npm run build
npm exec projscan -- file src/types.ts --format json
npm exec projscan -- file src/types/graph.ts --format json
```

## Ponytail Review: Public Graph Dataflow Type Extraction

Delete-list after this slice:

- Do not rename or remove `GraphEvidenceSummary`, `SemanticGraphNodeKind`,
  `SemanticGraphNode`, `SemanticGraphEdgeKind`, `SemanticGraphEdge`,
  `SemanticGraphReport`, `DataflowRiskKind`, `DataflowRiskSeverity`,
  `DataflowRiskConfidence`, `DataflowRisk`, or `DataflowReport` from
  `src/types.ts`.
- Do not let `src/types/graph.ts` import from `src/types.ts`.
- Do not change graph metrics, node/edge fields, dataflow risk fields,
  dataflow report fields, review output, CLI output, MCP schemas, plugin
  context types, package exports, dependencies, lockfiles, README, guide docs,
  or start-command behavior in this slice.
- Do not extract preflight, workplan, StartReport, review, PR diff, impact, or
  config types until their dependency order can be handled without barrel
  cycles.

Reviewer edge case: a consumer importing `DataflowReport` from `src/types.js`
must still see `risks: DataflowRisk[]`, and a review consumer must still be
able to reference the shared `DataflowRiskKind`, severity, and confidence
unions from the compatibility barrel.

Kept change: one leaf graph/dataflow type module, a compatibility barrel, a
compile-only type probe covering every moved graph/dataflow type,
typecheck/build verification, and this persona note.

## Fifty-Third Slice Decision

Selected persona: Session-Aware Agent.

Reason: a terminal-first agent should not need JSON mode to see that current
worktree evidence and remembered session context are different proof sources.
That distinction keeps older session touches from being treated as live diff
evidence during parallel-agent coordination.

Smallest fix: print the existing coordination `sessionSeparation` evidence in
the default `projscan coordinate` console `Evidence` section. Keep the JSON
schema unchanged.

Proof commands:

```bash
npm run test -- tests/cli/coordinate.test.ts -t "coordinate console surfaces local evidence"
npm run test -- tests/cli/coordinate.test.ts tests/core/coordination.test.ts tests/core/collisionDetector.test.ts tests/core/claims.test.ts tests/core/mergeRisk.test.ts tests/mcp/coordinateWatch.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Coordinate Console Session Boundary

Delete-list after this slice:

- Do not change `CoordinationCommandEvidence`, `CoordinationSummary`, or MCP
  output schemas.
- Do not change collision, claim, merge-risk, or watch semantics.
- Do not treat remembered session touches as current changed files.
- Do not add dependencies, telemetry, network calls, release actions, version
  bumps, or package-lock churn.

Reviewer edge case: unavailable single-worktree reports still need the evidence
block, because that is often the first local coordination command a user runs.

Kept change: one console-rendering addition, one CLI regression assertion,
focused docs, this persona note, and existing coordination verification.

## Fifty-Fourth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: Fastify documents host-derived request fields, and host header data can
be security-sensitive when it flows into persistence or routing decisions. The
static-analysis value comes from adding only framework-gated, qualified request
member patterns with a false-positive fixture.

Smallest fix: add Fastify `request.host` and `request.hostname` as qualified
request-source member references. Keep helper objects with the same field names
quiet, and keep the JSON schema unchanged.

Proof commands:

```bash
npm run test -- tests/core/dataflow.test.ts -t "Fastify request host fields"
npm run test -- tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Fastify Host Dataflow Sources

Delete-list after this slice:

- Do not broaden Fastify source matching to ungated `host` or `hostname`
  references.
- Do not change sink defaults, custom source/sink override behavior, or review
  report schemas.
- Do not add dependencies, network lookup, telemetry, package metadata changes,
  release actions, or version bumps.

Reviewer edge case: helper functions that accept a `{ host, hostname }` shaped
object should remain quiet even when the file imports Fastify.

Kept change: two qualified Fastify source strings, one source-to-sink fixture
with a helper lookalike, focused docs, this persona note, and existing dataflow
verification.

## Fifty-Fifth Slice Decision

Selected persona: Maintainer Preparing Review.

Reason: the review pass still ranks `src/mcp/server.ts` as a high-risk changed
file. Session recording is a cohesive state machine with its own concurrency,
dirty-write, tool-touch, and fs-watch behavior, so moving it behind a small
recorder boundary reduces server orchestration risk without changing MCP
contracts.

Smallest fix: extract session recording into `src/mcp/serverSession.ts` and
have `createMcpServer` call `recordToolCall`, `recordFileWatch`, and `flush`.
Keep dispatch, progress, watch, notification, and tool payload behavior
unchanged.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "session recording out of server orchestration"
npm run test -- tests/mcp/server.test.ts tests/mcp/sessionIntegration.test.ts tests/mcp/memoryIntegration.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/progress.test.ts tests/mcp/crossCutting.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/mcp/server.ts --format json
npm exec projscan -- file src/mcp/serverSession.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: MCP Server Session Recorder Extraction

Delete-list after this slice:

- Do not change JSON-RPC dispatch, initialize capabilities, MCP schemas, tool
  payload shape, progress notifications, or file-change notifications.
- Do not change session skip behavior for `projscan_session` and
  `projscan_cost_summary`.
- Do not make session recording mandatory; it remains best-effort.
- Do not add dependencies, network calls, telemetry, release actions, version
  bumps, or package metadata changes.

Reviewer edge case: concurrent first session loads still share one in-flight
load promise, so adjacent tool calls do not overwrite each other's touches.

Kept change: one focused session recorder module, one maintainability
regression, existing MCP session/progress/watch behavior tests, this persona
note, and no public schema changes.

## Fifty-Sixth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: scoped evidence must redact repo paths without destroying useful
reviewer context. External HTTP(S) documentation links can contain file-like
suffixes, and over-redacting them makes exported findings harder to review.

Smallest fix: preserve path-like tokens that are part of an HTTP(S) URL while
continuing to redact standalone file-like tokens. Keep local/file URL and
repo-path handling conservative.

Proof commands:

```bash
npm run test -- tests/core/reportScope.test.ts -t "preserves http urls"
npm run test -- tests/core/reportScope.test.ts tests/reporters/jsonReporter.test.ts tests/reporters/sarifReporter.test.ts tests/reporters/markdownAnalysisReporter.test.ts tests/reporters/markdownHealthReporter.test.ts tests/reporters/htmlReporter.test.ts tests/cli/formatHandling.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Report Redaction URL Preservation

Delete-list after this slice:

- Do not weaken redaction for standalone repo-relative paths, absolute POSIX
  paths, or Windows paths.
- Do not change report-control metadata, path label format, SARIF/JSON shapes,
  scope filtering, or reporter APIs.
- Do not read secret values, add network calls, add telemetry, change
  dependencies, or touch package metadata.

Reviewer edge case: `https://.../src/private/file.ts` stays readable, but
`src/private/file.ts` in the same sentence still redacts to a stable label.

Kept change: one text-redaction guard, one regression fixture, focused docs,
this persona note, and existing reporter coverage.

## Fifty-Seventh Slice Decision

Selected persona: Platform And Release Owner.

Reason: Python teams adopting newer packaging standards need offline upgrade
evidence to work from the same local `pyproject.toml` file they already review.
PEP 735 dependency groups are internal/dev requirements, so they should appear
as dev-scope declared evidence rather than being ignored.

Smallest fix: parse `[dependency-groups]` arrays as dev-scope declared
dependencies, ignore `{ include-group = "..." }` composition entries, and add a
preview-level assertion for `declaredScope: "dev"`.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "PEP 735 dependency groups"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Python Dependency Groups

Delete-list after this slice:

- Do not query PyPI or add network-backed Python latest-version lookup.
- Do not treat `include-group` references as package dependencies.
- Do not change lockfile/current-version semantics, output schemas,
  dependencies, package metadata, release actions, or version numbers.

Reviewer edge case: inline arrays and multiline arrays both work, but group
composition entries remain group references, not declared packages.

Kept change: one pyproject parser helper path, parser and preview regressions,
focused docs, this persona note, and existing Python upgrade verification.

## Fifty-Eighth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: Next route handlers receive a Web `Request` or `NextRequest`, and the
request URL is often used for query-driven data access. A useful signal needs
the same precision as earlier framework sources: route-file gating, exported
HTTP method gating, and qualified member evidence.

Smallest fix: add `request.url` as a Next route source backed by
`memberReferences`. Keep non-HTTP helper functions in the same `route.ts` file
quiet, and keep output schemas unchanged.

Proof commands:

```bash
npm run test -- tests/core/dataflow.test.ts -t "Next route request.url"
npm run test -- tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Next Route URL Source

Delete-list after this slice:

- Do not treat arbitrary `.url` reads or helper `request.url` reads as request
  input outside exported Next route HTTP handlers.
- Do not broaden route-file matching beyond existing `app/**/route.*` and
  `src/app/**/route.*` conventions.
- Do not change sink defaults, custom source/sink override behavior, output
  schemas, dependencies, package metadata, release actions, or version numbers.

Reviewer edge case: a helper in the same route file that accepts a
`{ url: string }` object should stay quiet.

Kept change: one qualified Next source string, one source-to-sink fixture with a
helper lookalike, focused docs, this persona note, and existing dataflow
verification.

## Fifty-Ninth Slice Decision

Selected persona: Maintainer Preparing Review.

Reason: hotspot evidence ranked `src/core/frameworkSources.ts` as a high-risk
changed file after the Next URL dataflow slice. The concrete maintainability
risk was not an individual risky function anymore; it was the shared framework
matcher absorbing another cohesive framework-specific source family.

Smallest fix: extract only the Next route source matcher into
`src/core/frameworkNextRouteSources.ts`. Keep `frameworkSources.ts` as the
public entry point for `FRAMEWORK_REQUEST_SOURCES` and
`frameworkRequestSourceForFunction`, and add a structure regression so the
matcher does not drift back into the shared file.

Proof commands:

```bash
npm run test -- tests/core/frameworkSources.test.ts
npm run test -- tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkSources.ts --format json
npm exec projscan -- file src/core/frameworkNextRouteSources.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Next Source Matcher Extraction

Delete-list after this slice:

- Do not change framework source names, dataflow risk fields, CLI/MCP output
  schemas, or default sink behavior.
- Do not split every framework matcher yet; this slice only pays down the
  cohesive Next route matcher exposed by current hotspot evidence.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: Next route body-reader and URL fixtures should behave the
same after extraction, including helper lookalike suppression.

Kept change: one focused Next matcher module, one maintainability regression,
existing dataflow coverage, this persona note, and no public schema change.

## Sixtieth Slice Decision

Selected persona: Platform And Release Owner.

Reason: Python package-review workflows can start with only manifest evidence,
especially before source files are added or when reviewing dependency metadata
in isolation. The upgrade preview should use that local proof instead of
falling back to the Node package-not-found path.

Smallest fix: let root Python manifests, root requirements/constraints, and
known root Python lockfiles identify a Python project even when no `.py` file
exists. Keep nested manifests and network-backed PyPI lookup out of scope.

Proof commands:

```bash
npm run test -- tests/core/upgradePreview.test.ts -t "pyproject even before Python files"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Manifest-Only Python Upgrade Preview

Delete-list after this slice:

- Do not query PyPI, install packages, or add network-backed Python latest
  version lookup.
- Do not infer Python projects from arbitrary nested files or non-root
  manifests.
- Do not change Node upgrade behavior, output schemas, dependencies, package
  metadata, release actions, or version numbers.

Reviewer edge case: a repo with only root `pyproject.toml` and no `.py` files
should preview declared Python packages with an empty importer list.

Kept change: one project-detection gate, one upgrade-preview regression,
focused docs, this persona note, and existing Python upgrade verification.

## Sixty-First Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: the coordination workflow is useful only if the next agent sees the
same local validation step where it already looks for handoff context. A clear
multi-worktree state is still actionable because agents should preserve it by
rerunning `projscan coordinate` before starting more parallel edits.

Smallest fix: make `coordinationHints` return one advisory clear-state hint
when multiple worktrees are present and coordination is otherwise clear. Keep
single-worktree/unavailable coordination quiet and leave conflicted/caution
hints unchanged.

Proof commands:

```bash
npm run test -- tests/core/coordination.test.ts -t "multiple worktrees are clear"
npm run test -- tests/core/coordination.test.ts tests/core/agentBrief.test.ts tests/core/start.test.ts -t "coordination|agent brief returns compact|coordination hints"
npm run typecheck
npm run lint
npm run build
npm exec projscan -- agent-brief --format json
npm exec projscan -- coordinate --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Clear Swarm Agent Brief Hint

Delete-list after this slice:

- Do not make session memory look like current Git/worktree evidence.
- Do not add daemon, cloud, telemetry, or background watcher behavior.
- Do not change coordination schemas, output fields, package metadata, release
  actions, or version numbers.

Reviewer edge case: clear single-worktree coordination stays quiet, while clear
multi-worktree coordination gets one reminder to rerun `projscan coordinate`.

Kept change: one coordination hint branch, one coordination regression, focused
docs, this persona note, and existing coordination/agent-brief coverage.

## Sixty-Second Slice Decision

Selected persona: Maintainer Preparing Review.

Reason: the Python manifest parser is easier to review when root project
evidence detection is not mixed with dependency and lockfile parsing. The
manifest-only preview behavior still matters, but the gate is its own
validation concern.

Smallest fix: move root Python project evidence detection into a focused module
and keep `detectPythonProject` using one imported predicate. Preserve
requirements and constraints parsing behavior in the manifest parser.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "project evidence gating"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/languages/pythonManifests.ts --format json
npm exec projscan -- file src/core/languages/pythonProjectEvidence.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
git diff --check
```

## Review Guardrails: Python Project Evidence Extraction

Delete-list after this slice:

- Do not change Python dependency parsing, lockfile parsing, or upgrade preview
  output fields.
- Do not broaden project detection beyond root Python manifests,
  requirements/constraints files, known lockfiles, and `.py`/`.pyw` files.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: a root `pyproject.toml` without Python files still counts
as Python project evidence, while nested manifests remain out of scope.

Kept change: one focused project-evidence module, one maintainability
regression, existing Python behavior coverage, this persona note, and no public
schema change.

## Sixty-Third Slice Decision

Selected persona: OSS Maintainer Reviewing Hotspots.

Reason: root requirements and constraints handling is a stable public behavior,
but it made the Python manifest detector do file selection, file reads,
dependency parsing, and lock-evidence conversion inline. A reviewer should be
able to inspect that behavior without reading the whole manifest parser.

Smallest fix: move root requirements/constraints evidence into a focused module
and move the shared PEP 508 splitter into a tiny parser module. Keep
`pythonManifests.ts` compatibility re-exports so existing imports keep working.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "root requirements evidence"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/languages/pythonManifests.ts --format json
npm exec projscan -- file src/core/languages/pythonRequirements.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify npm run typecheck
git diff --check
```

## Review Guardrails: Python Requirements Evidence Extraction

Delete-list after this slice:

- Do not change requirements/constraints parsing semantics, lockfile parsing,
  Python project detection rules, or upgrade preview output fields.
- Do not add PyPI/network lookup, install Python tooling, or add dependencies.
- Do not change package metadata, release actions, or version numbers.

Reviewer edge case: root pinned constraints continue to provide current-version
evidence without declaring dependencies, and `parseRequirements` /
`splitPep508` remain importable from `pythonManifests.ts`.

Kept change: one focused requirements evidence module, one tiny PEP 508 splitter
module, compatibility re-exports, one maintainability regression, this persona
note, and existing Python behavior coverage.

## Sixty-Fourth Slice Decision

Selected persona: Maintainer Reviewing Root Detection.

Reason: Python package-root inference has different review risks than
dependency parsing. It decides where package code lives from `pyproject.toml`
metadata and `__init__.py` placement, so it should be inspectable without
reading every manifest dependency parser.

Smallest fix: move `pyproject.toml` root extraction and `__init__.py` fallback
root inference into `pythonRoots.ts`. Keep `detectPythonProject` as the
orchestrator and preserve final `.` fallback behavior.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "package root inference"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/languages/pythonManifests.ts --format json
npm exec projscan -- file src/core/languages/pythonRoots.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
git diff --check
```

## Review Guardrails: Python Package Root Extraction

Delete-list after this slice:

- Do not change root inference semantics, package-root fallback behavior,
  dependency parsing, lockfile parsing, or upgrade preview output fields.
- Do not add dependencies, Python runtime execution, network calls, package
  metadata changes, release actions, or version numbers.

Reviewer edge case: projects with setuptools `where`, package-dir metadata,
Poetry `from`, or only nested `__init__.py` files should keep the same inferred
package roots.

Kept change: one focused root-inference module, one maintainability regression,
existing Python behavior coverage, this persona note, and no public schema
change.

## Sixty-Fifth Slice Decision

Selected persona: Security-Conscious Framework Reviewer.

Reason: Koa request-source matching is security-sensitive but cohesive: it has
its own import gate, handler-call gate, context parameter names, member
references, and member-call accessors. Keeping it in the shared framework
orchestrator makes unrelated framework changes harder to review.

Smallest fix: move Koa source maps and matching helpers into
`frameworkKoaSources.ts`, then import only the source list and matcher from the
shared orchestrator. Preserve all Koa source names and gating behavior.

Proof commands:

```bash
npm run test -- tests/core/frameworkSources.test.ts -t "Koa source matching"
npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts -t "Koa|framework source|dataflow"
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkSources.ts --format json
npm exec projscan -- file src/core/frameworkKoaSources.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts -t "Koa|framework source|dataflow"
git diff --check
```

## Review Guardrails: Koa Source Matcher Extraction

Delete-list after this slice:

- Do not change Koa source names, handler gating, source enablement,
  dataflow output fields, or default sink behavior.
- Do not broaden Koa matching to helper lookalikes or non-Koa imports.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: Koa body/query/header/IP fixtures and header/cookie accessor
fixtures should behave the same after extraction, while non-handler lookalikes
stay quiet.

Kept change: one focused Koa matcher module, one maintainability regression,
existing Koa dataflow coverage, this persona note, and no public schema change.

## Sixty-Sixth Slice Decision

Selected persona: Security-Conscious Framework Reviewer.

Reason: Express request-source matching is a common security review path, and
its body/query/params/header/cookie/IP plus accessor patterns should be
reviewed in one focused place instead of mixed with other framework gates.

Smallest fix: move Express source maps and matching helpers into
`frameworkExpressSources.ts`, then import only the source list and matcher from
the shared orchestrator. Preserve all Express source names and gating behavior.

Proof commands:

```bash
npm run test -- tests/core/frameworkSources.test.ts -t "Express source matching"
npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkSources.ts --format json
npm exec projscan -- file src/core/frameworkExpressSources.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
git diff --check
```

## Review Guardrails: Express Source Matcher Extraction

Delete-list after this slice:

- Do not change Express source names, handler gating, source enablement,
  dataflow output fields, or default sink behavior.
- Do not broaden Express matching to helper lookalikes or non-Express imports.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: Express body/query/params/header/cookie/IP fixtures and
header accessor fixtures should behave the same after extraction, while
non-handler lookalikes stay quiet.

Kept change: one focused Express matcher module, one maintainability
regression, existing Express dataflow coverage, this persona note, and no
public schema change.

## Sixty-Seventh Slice Decision

Selected persona: Security-Conscious Framework Reviewer.

Reason: Fastify request-source matching covers both common request fields and
Fastify-specific host/raw metadata. Keeping that matcher isolated makes it
clear which sources are framework-gated and prevents unrelated Hono or Express
edits from obscuring Fastify behavior.

Smallest fix: move Fastify source maps and matching helpers into
`frameworkFastifySources.ts`, then import only the source list and matcher from
the shared orchestrator. Preserve all Fastify source names and gating behavior.

Proof commands:

```bash
npm run test -- tests/core/frameworkSources.test.ts -t "Fastify source matching"
npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkSources.ts --format json
npm exec projscan -- file src/core/frameworkFastifySources.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
git diff --check
```

## Review Guardrails: Fastify Source Matcher Extraction

Delete-list after this slice:

- Do not change Fastify source names, handler gating, source enablement,
  dataflow output fields, or default sink behavior.
- Do not broaden Fastify matching to helper lookalikes or non-Fastify imports.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: Fastify body/query/params/header/cookie/IP fixtures and
raw/host metadata fixtures should behave the same after extraction, including
object-option route handlers.

Kept change: one focused Fastify matcher module, one maintainability
regression, existing Fastify dataflow coverage, this persona note, and no
public schema change.

## Sixty-Eighth Slice Decision

Selected persona: Security-Conscious Framework Reviewer.

Reason: Hono request-source matching is compact but security-sensitive. It
combines Hono import gating, handler method gating, context parameter aliases,
and `c.req.*` accessor matching, so it should be reviewed in one Hono-specific
module rather than inside the shared framework orchestrator.

Smallest fix: move Hono source maps and matching helpers into
`frameworkHonoSources.ts`, then import only the source list and matcher from
the shared orchestrator. Preserve all Hono source names and gating behavior.

Proof commands:

```bash
npm run test -- tests/core/frameworkSources.test.ts -t "Hono source matching"
npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkSources.ts --format json
npm exec projscan -- file src/core/frameworkHonoSources.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/frameworkSources.test.ts tests/core/dataflow.test.ts tests/core/taint.test.ts
git diff --check
```

## Review Guardrails: Hono Source Matcher Extraction

Delete-list after this slice:

- Do not change Hono source names, handler gating, source enablement,
  dataflow output fields, or default sink behavior.
- Do not broaden Hono matching to helper lookalikes or non-Hono imports.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: Hono JSON/body/text/query/param/header/validator fixtures
should behave the same after extraction, while same-file helper lookalikes stay
quiet unless they are passed as Hono handlers.

Kept change: one focused Hono matcher module, one maintainability regression,
existing Hono dataflow coverage, this persona note, and no public schema
change.

## Sixty-Ninth Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: Review tier shaping controls how much evidence an agent receives under
token budgets. It should be reviewable without reading git worktree setup,
cycle classification, manifest diffing, or dataflow comparison logic.

Smallest fix: move tier selection, totals, summary trimming, and verdict-only
shaping into `reviewTier.ts`, then re-export `selectReviewTier` and
`shapeReviewForTier` from `review.ts` so current callers keep working.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "tier shaping isolated"
npm run test -- tests/core/reviewTier.test.ts tests/core/review.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/crossCutting.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewTier.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/reviewTier.test.ts tests/core/review.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/crossCutting.test.ts
git diff --check
```

## Review Guardrails: Review Tier Extraction

Delete-list after this slice:

- Do not change review tier thresholds, tier names, totals, summary trimming,
  verdict-only fields, MCP cost-sidecar behavior, or public review schemas.
- Do not remove the compatibility exports from `review.ts`.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: `max_cost_tokens=0` and omitted budgets still return full
review output, while low and mid budgets keep the same `verdict-only` and
`summary` shapes.

Kept change: one focused review tier module, one maintainability regression,
existing review-tier and MCP budget coverage, this persona note, and no public
schema change.

## Seventieth Slice Decision

Selected persona: OSS Maintainer.

Reason: New/expanded dependency-cycle classification is small but easy to
break during review orchestration work. It decides whether a PR introduced
architecture debt and how added-file cycles are prioritized, so it should be
reviewable without reading git worktree and manifest diff setup.

Smallest fix: move cycle scoping, overlap counting, new/expanded
classification, and added-file ordering into `reviewCycles.ts`, then import
only `classifyNewCycles` and `scopeCyclesToFiles` from `review.ts`.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "cycle classification isolated"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewCycles.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
git diff --check
```

## Review Guardrails: Review Cycle Extraction

Delete-list after this slice:

- Do not change review cycle classification semantics, package scoping,
  added-file sort priority, verdict inputs, or public review schemas.
- Do not broaden cycle detection beyond the existing coupling report inputs.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: identical base/head cycles should stay quiet, expanded
cycles should still surface as `expanded`, and cycles touching newly added
files should remain first in the review list.

Kept change: one focused review cycle module, one maintainability regression,
existing review behavior coverage, this persona note, and no public schema
change.

## Seventy-First Slice Decision

Selected persona: Maintainer Reviewing Python Upgrade Evidence.

Reason: pyproject parsing is the highest-risk remaining part of Python
manifest detection. It interprets PEP 621 dependencies, optional dependency
groups, Poetry dependencies, and PEP 735 dependency groups that feed upgrade
preview evidence.

Smallest fix: move pyproject dependency parsing into `pythonPyproject.ts`,
move shared list/line helpers into `pythonManifestText.ts`, and keep
`parsePyproject` re-exported from `pythonManifests.ts`.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "pyproject dependency parsing"
npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/languages/pythonManifests.ts --format json
npm exec projscan -- file src/core/languages/pythonPyproject.ts --format json
npm exec projscan -- file src/core/languages/pythonManifestText.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/languages/pythonManifests.test.ts tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts tests/reporters/markdownUpgradeReporter.test.ts tests/reporters/consoleUpgradeReporter.test.ts
git diff --check
```

## Review Guardrails: Python Pyproject Parser Extraction

Delete-list after this slice:

- Do not change pyproject dependency semantics, emitted source names, scopes,
  line numbers, upgrade preview fields, or public imports.
- Do not add TOML dependencies, Python runtime execution, PyPI/network lookup,
  package metadata changes, release actions, or version numbers.
- Do not remove the compatibility re-export from `pythonManifests.ts`.

Reviewer edge case: PEP 621 dependencies, optional dependencies, Poetry main
and group dependencies, legacy Poetry dev-dependencies, and PEP 735
dependency-groups should keep the same parsed names, scopes, version specs, and
line numbers.

Kept change: one focused pyproject parser module, one shared text-helper
module, one maintainability regression, existing Python parser coverage, this
persona note, and no public schema change.

## Seventy-Second Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: file-purpose labels are part of the first read an agent gets from
`projscan file`. They should be easy to review without scanning path-safety,
graph-cache, hotspot, and issue-detection code in `fileInspector.ts`.

Smallest fix: move filename, directory, and export-shape purpose rules into
`filePurpose.ts`, then re-export `inferPurpose` from `fileInspector.ts` so
existing callers keep working.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "purpose inference rules|inferPurpose"
npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/filePurpose.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
git diff --check
```

## Review Guardrails: File Purpose Extraction

Delete-list after this slice:

- Do not change purpose labels, rule order, graph-backed import/export output,
  file-inspection schema fields, path-safety behavior, or public imports.
- Do not broaden file reads, read secret values, add dependencies, package
  metadata changes, release actions, or version numbers.
- Do not remove the compatibility re-export from `fileInspector.ts`.

Reviewer edge case: test/spec, config/rc, index, route, service, component,
model/schema, and class/function-library fallback labels should stay identical.

Kept change: one focused file-purpose module, one maintainability regression,
existing file-inspector coverage, this persona note, and no public schema
change.

## Seventy-Third Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: graph export-kind mapping is part of the `projscan file` payload an
agent consumes, but it does not belong in the path-safety and graph-loading
orchestrator. Isolating it makes future graph export-kind changes easier to
review.

Smallest fix: move `mapExportType` into `fileExportTypes.ts` and import it
from `fileInspector.ts`. Keep all emitted export type labels identical.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "export type mapping"
npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/fileExportTypes.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
git diff --check
```

## Review Guardrails: File Export Type Extraction

Delete-list after this slice:

- Do not change export type labels, graph-backed import/export output,
  file-inspection schema fields, path-safety behavior, or public imports.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: graph export kinds `function`, `class`, `variable`,
`type`, `interface`, and `default` should pass through unchanged; `enum`
should still map to `type`; unknown kinds should still map to `unknown`.

Kept change: one focused export-type mapper module, one maintainability
regression, existing file-inspector coverage, this persona note, and no public
schema change.

## Seventy-Fourth Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: file issue detection feeds the `projscan file` payload that agents use
when deciding whether a file needs attention, but those linter-style checks do
not belong in the path-safety and graph-loading orchestrator. Isolating them
makes future issue-rule changes easier to review.

Smallest fix: move `detectFileIssues` into `fileIssues.ts`, import it from
`fileInspector.ts`, and re-export it from `fileInspector.ts` so existing
callers keep working. Keep every emitted issue label and threshold unchanged.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "file issue detection"
npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/fileIssues.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
git diff --check
```

## Review Guardrails: File Issue Detection Extraction

Delete-list after this slice:

- Do not change large-file thresholds, console/TODO/`any` detection patterns,
  emitted issue labels, file-inspection schema fields, path-safety behavior, or
  the `detectFileIssues` export from `fileInspector.ts`.
- Do not add dependencies, package metadata changes, release actions, or
  version numbers.

Reviewer edge case: files above 500 lines should still emit the large-file
message; files above 1000 lines should still emit both large-file messages;
console calls, TODO-family comments, and TypeScript `any` annotations should
still emit the same labels.

Kept change: one focused file-issue module, one maintainability regression,
existing file-inspector coverage, this persona note, and no public schema
change.

## Seventy-Fifth Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: graph-derived complexity, fan-in, fan-out, and function summaries are
important for agents triaging files, but metric shaping is separate from
file-access safety and payload orchestration. Isolating it keeps future metric
changes reviewable without rereading the full inspector.

Smallest fix: move graph metric shaping into `fileGraphMetrics.ts` and call
`deriveFileGraphMetrics` from `fileInspector.ts`. Preserve null behavior for
missing graph entries, parse-failed complexity, fan-in/fan-out counts, and
function sorting by descending cyclomatic complexity.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "graph metric shaping"
npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/fileGraphMetrics.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
git diff --check
```

## Review Guardrails: File Graph Metric Extraction

Delete-list after this slice:

- Do not change `cyclomaticComplexity`, `fanIn`, `fanOut`, `language`, or
  `functions` field semantics; do not change function summary shape, sorting
  order, or missing-graph null behavior.
- Do not change graph construction, cache behavior, path-safety behavior,
  issue detection, import/export mapping, dependencies, package metadata,
  release actions, or version numbers.

Reviewer edge case: unparsed graph entries should still report null
cyclomatic complexity, files absent from the graph should still report null
metrics, and function summaries should remain sorted by descending CC.

Kept change: one focused graph-metric module, one maintainability regression,
existing file-inspector and reporter coverage, this persona note, and no public
schema change.

## Seventy-Sixth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: the file-inspection path-safety block is security-sensitive because it
guards absolute path use, traversal, symlink escapes, and secret-adjacent file
reads. It should be isolated so reviewers can reason about access policy
without reading import/export, hotspot, and metric payload assembly.

Smallest fix: move safe project-file reading into `fileAccess.ts` as
`readProjectFile`, and keep `fileInspector.ts` responsible for converting
failed reads into the existing `FileInspection` response. Preserve every
failure reason and relative-path behavior.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "file access path safety"
npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/fileAccess.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/fileInspector.test.ts tests/mcp/server.test.ts tests/reporters/markdownReporter.test.ts
git diff --check
```

## Review Guardrails: File Access Extraction

Delete-list after this slice:

- Do not change absolute-path refusal, traversal rejection, symlink escape
  blocking, in-root symlink support, missing-file and non-file reasons, or the
  reported relative path for in-root symlinks.
- Do not read environment files or secrets, add network calls or telemetry,
  change public schemas/imports, alter graph/cache behavior, add dependencies,
  change package metadata, perform release actions, or change version numbers.

Reviewer edge case: a symlink inside the project that points outside should
still be rejected, while a symlink that points inside the project should remain
readable and report the user-supplied alias path.

Kept change: one focused access-policy module, one maintainability regression,
existing security regression coverage, this persona note, and no public schema
change.

## Seventy-Seventh Slice Decision

Selected persona: Platform/Release Owner.

Reason: report-policy presets back the scoped/redacted evidence controls used
by `analyze`, `doctor`, and `ci`. The config loader should keep those preset
rules isolated so release reviewers can verify export controls without
re-reading unrelated config branches.

Smallest fix: move report-policy preset normalization into
`configReportPolicies.ts` and import `applyReportPolicies` from `config.ts`.
Keep `reportScope` filtering, `redactPaths` boolean handling, invalid preset
dropping, and preset names unchanged.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "report policy preset normalization"
npm run test -- tests/utils/config.test.ts tests/core/reportScope.test.ts tests/reporters/jsonReporter.test.ts tests/reporters/sarifReporter.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configReportPolicies.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/core/reportScope.test.ts tests/reporters/jsonReporter.test.ts tests/reporters/sarifReporter.test.ts
git diff --check
```

## Review Guardrails: Report Policy Config Extraction

Delete-list after this slice:

- Do not change the public config schema, report policy names, `reportScope`
  filtering, `redactPaths` boolean behavior, invalid preset dropping, or
  report-control metadata emitted by reporters.
- Do not read environment files or secret values, add dependencies, change
  package metadata, perform release actions, or change version numbers.

Reviewer edge case: a preset with `reportScope: ['src/api', '', './packages/backend/']`
and `redactPaths: true` should still normalize to exactly the two non-empty
scope strings plus `redactPaths: true`; invalid presets should still be dropped.

Kept change: one focused report-policy config module, one maintainability
regression, existing config and report-scope coverage, this persona note, and
no public schema change.

## Seventy-Eighth Slice Decision

Selected persona: Platform/Release Owner.

Reason: monorepo import-policy config controls cross-package boundary checks,
which are important for teams using projscan in multi-package repos. Keeping
allow/deny normalization separate from the general config loader makes those
boundary rules easier to review.

Smallest fix: move monorepo import-policy normalization into
`configMonorepo.ts` and import `applyMonorepo` from `config.ts`. Preserve
`from`, `allow`, and `deny` filtering exactly.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "monorepo import policy normalization"
npm run test -- tests/utils/config.test.ts tests/analyzers/crossPackageImportCheck.test.ts tests/types/public-config-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configMonorepo.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/analyzers/crossPackageImportCheck.test.ts tests/types/public-config-types.test.ts
git diff --check
```

## Review Guardrails: Monorepo Config Extraction

Delete-list after this slice:

- Do not change the public config schema, `monorepo.importPolicy` shape,
  `from` requirements, `allow`/`deny` filtering, invalid rule dropping, or
  cross-package import violation behavior.
- Do not add dependencies, change package metadata, perform release actions,
  change version numbers, or read secret values.

Reviewer edge case: rules without a non-empty string `from` should still be
dropped; `allow` and `deny` should still keep only string entries; a rule should
only be retained when it has an `allow` or `deny` list.

Kept change: one focused monorepo config module, one maintainability
regression, existing cross-package import-policy coverage, this persona note,
and no public schema change.

## Seventy-Ninth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: scan config includes `scanEnvValues`, which controls whether projscan
may inspect tracked `.env` values. Keeping those privacy toggles isolated makes
secret-adjacent behavior easier to audit.

Smallest fix: move scan option normalization into `configScan.ts` and import
`applyScan` from `config.ts`. Preserve boolean-only handling for
`includeIgnored`, `scanEnvValues`, and `offline`.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "scan privacy option normalization"
npm run test -- tests/utils/config.test.ts tests/core/issueEngine.trustConfig.test.ts tests/types/public-config-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configScan.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/core/issueEngine.trustConfig.test.ts tests/types/public-config-types.test.ts
git diff --check
```

## Review Guardrails: Scan Config Extraction

Delete-list after this slice:

- Do not change the public config schema, `includeIgnored`, `scanEnvValues`, or
  `offline` boolean-only handling.
- Do not make `.env` value scanning implicit; it must still require explicit
  `scan.scanEnvValues: true`.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: tracked `.env` files should remain path-only by default,
and should only produce hardcoded-secret findings when `scan.scanEnvValues` is
explicitly configured.

Kept change: one focused scan config module, one maintainability regression,
existing trust-config coverage, this persona note, and no public schema change.

## Eightieth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: taint config controls project-specific source and sink names used by
review-blocking flow analysis. Keeping source/sink normalization separate from
the general config loader makes analyzer-tuning behavior easier to audit.

Smallest fix: move taint option normalization into `configTaint.ts` and import
`applyTaint` from `config.ts`. Preserve string-only, non-empty filtering for
`taint.sources` and `taint.sinks`.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "taint option normalization"
npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts tests/mcp/taintIntegration.test.ts tests/core/taint.test.ts tests/core/dataflow.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configTaint.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts tests/mcp/taintIntegration.test.ts tests/core/taint.test.ts tests/core/dataflow.test.ts
git diff --check
```

## Review Guardrails: Taint Config Extraction

Delete-list after this slice:

- Do not change the public config schema, `taint.sources`, or `taint.sinks`
  string-only/non-empty filtering.
- Do not alter built-in taint defaults, review verdicting, dataflow behavior, or
  generated-code suppression behavior.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: invalid source or sink entries should continue to be
dropped, and configured names should still merge on top of built-in taint
defaults in CLI, MCP, review, and dataflow paths.

Kept change: one focused taint config module, one maintainability regression,
existing config/taint coverage, this persona note, and no public schema change.

## Eighty-First Slice Decision

Selected persona: OSS Maintainer.

Reason: hotspot config affects how maintainers rank risky files by churn and
complexity. Isolating `limit` and `since` normalization keeps that review path
small without changing the public config schema or analyzer behavior.

Smallest fix: move hotspot option normalization into `configHotspots.ts` and
import `applyHotspots` from `config.ts`. Preserve `limit` clamping to 1..100,
integer flooring, and trimmed non-empty `since` handling.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "hotspot option normalization"
npm run test -- tests/utils/config.test.ts tests/core/hotspotAnalyzer.test.ts tests/types/public-config-types.test.ts tests/types/public-hotspot-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configHotspots.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/core/hotspotAnalyzer.test.ts tests/types/public-config-types.test.ts tests/types/public-hotspot-types.test.ts
git diff --check
```

## Review Guardrails: Hotspot Config Extraction

Delete-list after this slice:

- Do not change the public config schema, `hotspots.limit`, or
  `hotspots.since` behavior.
- Do not change hotspot ranking, churn collection, coverage joining, reporter
  output, or default CLI limit/since values.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: fractional and out-of-range limits should still be floored
and clamped to 1..100, and blank `since` strings should still be ignored.

Kept change: one focused hotspot config module, one maintainability regression,
existing config/hotspot coverage, this persona note, and no public schema
change.

## Eighty-Second Slice Decision

Selected persona: Platform / Release Owner.

Reason: severity overrides influence release and review evidence by remapping
issue severities. Keeping the allow-list and override parsing outside the
general loader makes that behavior easier to audit without changing issue
schemas or verdict logic.

Smallest fix: move severity override normalization into `configSeverity.ts` and
import `applySeverityOverrides` from `config.ts`. Preserve the accepted
severity set of `info`, `warning`, and `error`, and continue dropping invalid
override values.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "severity override normalization"
npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configSeverity.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
git diff --check
```

## Review Guardrails: Severity Config Extraction

Delete-list after this slice:

- Do not change the public config schema, accepted severity names, or invalid
  override dropping behavior.
- Do not change disable-rule filtering, issue IDs, verdict logic, report
  output, or release-train wording.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: `severityOverrides` entries with values other than
`info`, `warning`, or `error` should still be ignored, and valid exact issue-id
matches should still remap issue severity later in `applyConfigToIssues`.

Kept change: one focused severity config module, one maintainability
regression, existing config/issue-trust coverage, this persona note, and no
public schema change.

## Eighty-Third Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: agents often import `applyConfigToIssues` through the config utility
while using issue lists as handoff evidence. Moving the rule-application logic
behind the same public export keeps the contract stable and narrows future
review of disable-rule and severity-remap behavior.

Smallest fix: move `applyConfigToIssues` and its wildcard matcher into
`configIssueRules.ts`, then re-export `applyConfigToIssues` from `config.ts`.
Preserve exact id matches, trailing-`*` prefix disables, and exact-id severity
overrides.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "issue rule application"
npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configIssueRules.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
git diff --check
```

## Review Guardrails: Config Issue-Rule Extraction

Delete-list after this slice:

- Do not change the public `applyConfigToIssues` import path from
  `src/utils/config.ts`.
- Do not change exact disable-rule matching, trailing-wildcard prefix matching,
  exact-id severity override matching, issue IDs, or issue output shape.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: `large-*` should still suppress `large-utils-dir`, an
exact disabled id should still suppress only that issue, and severity overrides
should still clone only remapped issues.

Kept change: one focused issue-rule module, one maintainability regression,
existing config/issue-trust coverage, this persona note, and no public API
break.

## Eighty-Fourth Slice Decision

Selected persona: OSS Maintainer.

Reason: the remaining embedded config helpers are routine scalar/list
normalizers. Moving them together keeps the loader focused on file discovery
and composition while preserving the small public config behaviors maintainers
expect.

Smallest fix: move `minScore`, `baseRef`, `ignore`, and `disableRules`
normalization into `configBasics.ts`, then import those helpers from
`config.ts`. Preserve min-score clamping, base-ref trimming, and string-only
list filtering.

Proof commands:

```bash
npm run test -- tests/utils/config.test.ts -t "basic scalar and list normalization"
npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/utils/config.ts --format json
npm exec projscan -- file src/utils/configBasics.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/utils/config.test.ts tests/types/public-config-types.test.ts tests/core/issueEngine.trustConfig.test.ts
git diff --check
```

## Review Guardrails: Basic Config Extraction

Delete-list after this slice:

- Do not change the public config schema, `minScore`, `baseRef`, `ignore`, or
  `disableRules` behavior.
- Do not change config file discovery order, package.json fallback behavior,
  issue-rule application, or any report/review verdict behavior.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: `minScore` should still floor and clamp to 0..100,
`baseRef` should still trim non-empty strings, and `ignore` / `disableRules`
should still keep only non-empty strings.

Kept change: one focused basic config module, one maintainability regression,
existing config/issue-trust coverage, this persona note, and no public schema
change.

## Eighty-Fifth Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: `projscan start` is the entry point agents use to choose the next
workflow and handoff path. Adoption gaps are setup evidence, not orchestration,
so isolating their projection makes the start report easier to review without
changing the JSON or CLI contract.

Smallest fix: move first-run diagnostic to `StartAdoptionGap` shaping into
`startAdoptionGaps.ts` and call `buildStartAdoptionGaps` from `start.ts`.
Preserve non-pass filtering, status mapping, labels, summaries, and optional
commands.

Proof commands:

```bash
npm run test -- tests/core/start.test.ts -t "adoption gap shaping"
npm run test -- tests/core/start.test.ts tests/cli/start.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/start.ts --format json
npm exec projscan -- file src/core/startAdoptionGaps.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/core/start.test.ts tests/cli/start.test.ts
git diff --check
```

## Review Guardrails: Start Adoption-Gap Extraction

Delete-list after this slice:

- Do not change `projscan start` JSON fields, CLI rendering, setup diagnostics,
  adoption-loop data, mission-control data, or next-action ordering.
- Do not change which diagnostics become adoption gaps; only non-pass
  diagnostics should be projected.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.

Reviewer edge case: diagnostics with `command` should keep it in the adoption
gap, pass diagnostics should stay out, and warning/failure statuses should
remain unchanged.

Kept change: one focused start evidence projection module, one maintainability
regression, existing start core/CLI coverage, this persona note, and no public
schema change.

## Eighty-Sixth Slice Decision

Selected persona: Security-Conscious Reviewer.

Reason: MCP message parsing is protocol boundary code. Isolating raw line
trimming, JSON parse failure handling, and JSON-RPC request validation makes the
public server surface easier to audit without changing tool dispatch,
notifications, session recording, or transport behavior.

Smallest fix: move raw JSON-RPC message parsing into `serverMessage.ts` and
have `server.ts` dispatch only validated requests or return the parser's
error response. Preserve parse-error code `-32700`, invalid-request code
`-32600`, empty-line null responses, and request-id preservation for invalid
requests.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "message parsing"
npm run test -- tests/mcp/server.test.ts tests/mcp/serverBudget.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/crossCutting.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/progress.test.ts tests/mcp/sessionIntegration.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/mcp/server.ts --format json
npm exec projscan -- file src/mcp/serverMessage.ts --format json
npm exec projscan -- release-train --format json
npm exec projscan -- review --format json
npm exec projscan -- bug-hunt --format json
npm exec agentflight -- verify -- npm run test -- tests/mcp/server.test.ts tests/mcp/serverBudget.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/crossCutting.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/progress.test.ts tests/mcp/sessionIntegration.test.ts
git diff --check
```

## Review Guardrails: MCP Message Parsing Extraction

Delete-list after this slice:

- Do not change MCP method names, tool/prompt/resource schemas, JSON-RPC error
  codes, response envelopes, notification behavior, watcher behavior, session
  recording, budget/cost sidecars, or stdout/stderr transport behavior.
- Do not add dependencies, network calls, telemetry, package metadata changes,
  release actions, or version numbers.
- Do not read or print secret values.

Reviewer edge case: blank lines should still return no response, malformed JSON
should still return `ParseError`, invalid JSON-RPC objects should still return
`InvalidRequest`, and initialized notifications should still be ignored by
dispatch.

Kept change: one focused message parser module, one maintainability regression,
existing MCP server coverage, this persona note, and no public MCP contract
change.

## Eighty-Seventh Slice Decision

Selected persona: Test Hygiene Reviewer.

Reason: The MCP budget sidecar test exercised `projscan_search` against the real
repository root, which records durable session touches and makes bug-hunt report
coordination conflicts unrelated to the implementation under review.

Smallest fix: run the truncation test against a temporary fixture repository,
generate enough matching files there to exercise the search result path, close
the MCP server on every exit path, and expand the maintainability guard so
real-root MCP tests cannot call session-recording tools including
`projscan_search`.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "session-recording tool tests"
npm run test -- tests/mcp/server.test.ts tests/mcp/serverBudget.test.ts
npm exec projscan -- session reset
npm run test -- tests/mcp/server.test.ts tests/mcp/serverBudget.test.ts tests/mcp/costSidecarIntegration.test.ts tests/mcp/crossCutting.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/progress.test.ts tests/mcp/sessionIntegration.test.ts
npm exec projscan -- session touched --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: MCP Test Session Hygiene

Delete-list after this slice:

- Do not change MCP runtime behavior, search ranking, budget sidecar shape,
  session recording semantics, or public JSON-RPC responses.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: tests may still call non-session tools against the real
repository root when they are only checking protocol envelopes, but any test
that calls `projscan_search`, `projscan_structure`, or `projscan_file` must use
a fixture root so durable session evidence stays reviewable.

Kept change: one fixture-root test cleanup, one expanded maintainability guard,
this persona note, and no product runtime behavior change.

## Eighty-Eighth Slice Decision

Selected persona: Platform Reviewer.

Reason: `computeReview` is a high-churn review hotspot and still owned the
clean identical-ref fast-path response shape inline. Extracting that report
assembly makes the review orchestrator easier to audit without changing
verdicts, diffing, intent analysis, package scoping, or graph/dataflow checks.

Smallest fix: move the no-change review response into
`reviewNoChanges.ts`, keep intent annotation in `review.ts`, and add a
maintainability regression that prevents the fast-path summary shape from
moving back into the orchestrator.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "no-change report assembly|no changes between identical refs|dirty worktree"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewNoChanges.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review No-Change Extraction

Delete-list after this slice:

- Do not change review verdict rules, package scoping, manifest diffing,
  contract-change detection, taint/dataflow comparison, graph evidence,
  worktree cleanup, git timeout behavior, or intent annotation.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: identical base/head with a clean worktree should still
return `available: true`, `verdict: ok`, an empty diff, and the existing
no-structural-changes summary; identical base/head with dirty files should
still take the full review path.

Kept change: one focused no-change report helper, one maintainability
regression, existing review behavior coverage, this persona note, and no public
schema change.

## Eighty-Ninth Slice Decision

Selected persona: Platform Reviewer.

Reason: `computeReview` still mixed current-worktree enrichment with base
worktree comparison. Moving head-side scan, graph, issue, and hotspot assembly
behind one helper narrows the review orchestrator without changing verdict
inputs or public review output.

Smallest fix: add `reviewHeadSnapshot.ts`, delegate head graph/hotspot
construction from `review.ts`, keep base worktree scan and cleanup in the
orchestrator, and guard against reintroducing issue/hotspot assembly inline.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "head-side scan"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewHeadSnapshot.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Head Snapshot Extraction

Delete-list after this slice:

- Do not change review verdict rules, hotspot scoring, issue collection,
  package scoping, base worktree checkout/cleanup, manifest diffing,
  taint/dataflow comparison, graph evidence, or intent annotation.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: the head snapshot must still use the current worktree,
limit hotspots to 200 for review enrichment, and pass the built code graph to
hotspot analysis so AST-derived complexity remains available.

Kept change: one focused head-snapshot helper, one maintainability regression,
existing review behavior coverage, this persona note, and no public schema
change.

## Ninetieth Slice Decision

Selected persona: Maintainer-Focused Refactorer.

Reason: `hotspotAnalyzer.ts` is a high-risk hotspot and already delegates
scoring, git churn, and issue matching. Line counting and LOC fallback were the
remaining low-level helpers inside the analyzer, so extracting them reduces
local complexity without changing hotspot ranking, memory writes, or public
report shape.

Smallest fix: move `countLines`, `lineCountOrEstimate`, and the private
`estimateLines` helper into `hotspotLines.ts`, keep analyzer candidate ordering
and top-K behavior unchanged, and add a maintainability regression to keep line
counting out of the analyzer.

Proof commands:

```bash
npm run test -- tests/core/hotspotAnalyzer.test.ts -t "line counting"
npm run test -- tests/core/hotspotAnalyzer.test.ts tests/core/hotspotIssueLinking.test.ts tests/core/hotspotCoverage.test.ts tests/types/public-hotspot-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json
npm exec projscan -- file src/core/hotspotLines.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Hotspot Line Helper Extraction

Delete-list after this slice:

- Do not change hotspot scoring, reason strings, churn collection, issue
  linking, coverage handling, graph complexity preference, memory acceptance
  tagging, candidate caps, or public hotspot report fields.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: empty files should still count as zero lines, unreadable
files should still fall back to size estimates, and files outside parser graph
coverage should still use LOC fallback.

Kept change: one focused line-helper module, one maintainability regression,
existing hotspot behavior coverage, this persona note, and no public schema
change.

## Ninety-First Slice Decision

Selected persona: Maintainer-Focused Refactorer.

Reason: Hotspot analysis still mixed ranking assembly with best-effort Project
Memory side effects. Moving observation and accepted-hotspot tagging into a
dedicated helper keeps the analyzer focused on report construction while
preserving the fail-open memory behavior.

Smallest fix: move `markAcceptedHotspots` into `hotspotMemory.ts`, keep the
same dynamic memory import and catch-all best-effort behavior, and add a
maintainability regression preventing memory tagging from returning to
`hotspotAnalyzer.ts`.

Proof commands:

```bash
npm run test -- tests/core/hotspotAnalyzer.test.ts -t "memory tagging"
npm run test -- tests/core/hotspotAnalyzer.test.ts tests/core/hotspotIssueLinking.test.ts tests/core/hotspotCoverage.test.ts tests/core/memory.test.ts tests/types/public-hotspot-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json
npm exec projscan -- file src/core/hotspotMemory.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Hotspot Memory Extraction

Delete-list after this slice:

- Do not change hotspot ranking, memory persistence format, accepted-hotspot
  thresholds, reason strings, scoring inputs, issue linking, coverage handling,
  graph complexity preference, or public hotspot report fields.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: memory failures must remain best-effort and must not break
hotspot analysis; accepted hotspots should still be back-tagged on the returned
top-K entries when memory says they crossed the acceptance threshold.

Kept change: one focused memory helper, one maintainability regression,
existing hotspot and memory behavior coverage, this persona note, and no public
schema change.

## Ninety-Second Slice Decision

Selected persona: Agent-Orchestrating Engineer.

Reason: MCP server lifecycle code controls long-running watchers, file-change
notifications, registered tool-side watches, and final session flushes. Keeping
that shutdown path out of request orchestration makes the server easier to
audit for leaked timers and late notifications without changing protocol
responses.

Smallest fix: move watcher startup, file-change notification emission,
fs-watch session recording, registered watch cancellation, watcher close
waiting, and session flush into `serverLifecycle.ts`; keep JSON-RPC parsing,
dispatch, and tool handlers in `server.ts`.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "watcher lifecycle"
npm run test -- tests/mcp/server.test.ts tests/mcp/fileChangedNotifications.test.ts tests/mcp/crossCutting.test.ts tests/mcp/sessionIntegration.test.ts tests/mcp/reviewWatch.test.ts tests/mcp/coordinateWatch.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/mcp/server.ts --format json
npm exec projscan -- file src/mcp/serverLifecycle.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: MCP Server Lifecycle Extraction

Delete-list after this slice:

- Do not change MCP method names, response envelopes, advertised capabilities,
  file-change notification payloads, watcher startup timing, registered
  tool-watch cancellation, session recording semantics, or transport behavior.
- Do not add dependencies, release actions, package metadata changes, or
  version numbers.

Reviewer edge case: watch mode should still advertise `experimental.fileChanged`
only when watch is enabled with a notify channel, initial watcher scans should
still not emit file-change notifications, close should still await watcher quiet
and flush the session, and tool-side watches should still be cancelled on close.

Kept change: one focused lifecycle helper, one maintainability regression,
existing MCP watcher/session coverage, this persona note, and no public MCP
schema change.

## Ninety-Second Slice Decision

Selected personas: Agent-Orchestrating Engineer and Platform/Release Owner.

Reason: the 4.6 swarm-validation roadmap line asks teams to prove which
coordination commands agents actually use. The detailed `coordinate` evidence
already listed the local workflow, but compact handoff hints did not carry that
proof path into the surfaces agents read while handing work to the next agent.

Smallest fix: derive coordination hint wording from the existing evidence
workflow and name the three local proof commands:

- `projscan coordinate --format json`
- `projscan coordinate --watch --interval 5 --format json`
- `projscan agent-brief --format json`

Proof commands:

```bash
npm run test -- tests/core/coordination.test.ts
npm run test -- tests/core/coordination.test.ts tests/core/agentBrief.test.ts tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- coordinate --format json
npm exec projscan -- agent-brief --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Coordination Validation Hints

Delete-list after this slice:

- Do not add a daemon, cloud service, telemetry, lockfile write, dependency,
  version change, or release action.
- Do not add new public JSON fields when existing `evidence.validationWorkflow`
  can drive the compact hint.
- Do not mix remembered session context with current Git/worktree evidence.

Reviewer edge case: unavailable single-worktree coordination should still return
no swarm hint; multi-worktree clear/conflicted hints should name the local
validation workflow; `agent-brief` should carry the hint as a compact message
without changing the structured report schema.

Kept change: one hint helper, one behavior test, one docs example update, this
persona note, and no schema change.

## Ninety-Second Slice Decision

Selected personas: OSS Maintainer and Security-Conscious Reviewer.

Reason: `src/core/review.ts` remains a high-churn production hotspot. Base
worktree checkout is security-sensitive because it shells out to git, uses
detached worktrees, and must always clean up temp directories. Keeping that
logic inside `computeReview` made review behavior harder to audit next to graph
diffing, verdict assembly, and intent grounding.

Smallest fix: move base-side detached worktree checkout, scan, graph build,
manifest read, cleanup, and git failure wording into `reviewBaseSnapshot.ts`;
move the review-local git runner into `reviewGit.ts`; keep `computeReview`
calling one base snapshot boundary.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "base worktree snapshot"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewBaseSnapshot.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Base Snapshot Extraction

Delete-list after this slice:

- Do not change review report schema, verdict inputs, package scoping,
  no-change behavior, intent grounding, or public CLI/MCP output.
- Do not remove the detached worktree `--` separator, git timeout, stdin
  detachment, best-effort worktree removal, or temp directory cleanup.
- Do not add dependencies, release actions, version changes, network calls, or
  secret reads.

Reviewer edge case: invalid base refs should still return an unavailable review
with the same reason shape; base worktree checkout failure should still include
the git failure summary; successful reviews should preserve changed-file,
cycle, dependency, contract, taint, dataflow, graph-evidence, and intent fields.

Kept change: one base snapshot helper, one review-local git helper, one
maintainability regression, existing review behavior coverage, this persona
note, and no public schema change.

## Ninety-Second Slice Decision

Selected personas: OSS Maintainer and Agent-Orchestrating Engineer.

Reason: package-scoped review is an agent-facing precision feature. Keeping
changed-file package filtering and graph-scope package selection inside
`computeReview` made the high-churn review orchestrator harder to scan and
mixed monorepo boundaries with verdict assembly.

Smallest fix: move package-scope file filtering and graph-scope selection into
`reviewPackageScope.ts`; keep `computeReview` calling those boundaries before
changed-file enrichment and graph evidence assembly.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "package scope filtering"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewPackageScope.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Package Scope Extraction

Delete-list after this slice:

- Do not change package-scoped review semantics, review report schema, graph
  evidence shape, verdict logic, or package manifest diff scoping.
- Do not broaden workspace detection, add dependency changes, or introduce
  network calls, release actions, version changes, or secret reads.

Reviewer edge case: unscoped reviews should still leave all changed files and
graph evidence intact; scoped reviews should still filter added, removed, and
modified files plus graph evidence to the selected workspace package.

Kept change: one package-scope helper module, one maintainability regression,
existing package-scoped review coverage, this persona note, and no public schema
change.

## Ninety-Second Slice Decision

Selected personas: Platform/Release Owner and OSS Maintainer.

Reason: release-train is the public planning surface for current roadmap work.
The core planner should stay easy to audit for read-only behavior, preflight
readiness, task ranking, and suggested actions. Legacy/default line fallbacks
are useful compatibility data, but keeping their branch-heavy catalog inline
obscured the current planning flow.

Smallest fix: move fallback product-line tracks and fallback tasks into
`releaseTrainFallbacks.ts`; keep `releaseTrain.ts` responsible for version
normalization, roadmap catalog lookup, readiness, ranking, and next actions.

Proof commands:

```bash
npm run test -- tests/core/releaseTrain.test.ts -t "fallback tracks and tasks"
npm run test -- tests/core/releaseTrain.test.ts tests/cli/releaseTrainBugHunt.test.ts tests/mcp/releaseTrainBugHunt.test.ts tests/types/public-release-train-types.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/releaseTrain.ts --format json
npm exec projscan -- file src/core/releaseTrainFallbacks.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Release-Train Fallback Extraction

Delete-list after this slice:

- Do not change release-train schema, default roadmap lines, task IDs, task
  order, readiness verdicts, suggested-action labels, or read-only behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: 2.x and 3.x fallback versions should still return the same
themes and task IDs; 4.4+ should still prefer roadmap-catalog post-4.4 lines;
preflight blockers should still inject `rt-blockers-first` ahead of plan tasks.

Kept change: one fallback catalog module, one source-boundary regression,
existing release-train behavior coverage, this persona note, and no public
schema change.

## Ninety-Second Slice Decision

Selected personas: Security-Conscious Reviewer and OSS Maintainer.

Reason: review git/ref state checks are small but security-sensitive: they
shell out to git, control the clean-worktree fast path, and decide which base
ref gets compared. Keeping that logic inside `computeReview` made the review
orchestrator harder to audit next to graph and verdict assembly.

Smallest fix: move repository detection, clean-worktree checks, commit SHA
resolution, and default-base selection into `reviewRefs.ts`; keep the existing
review-local git runner and timeout behavior unchanged.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "git ref and worktree state"
npm run test -- tests/core/review.test.ts tests/core/reviewTier.test.ts tests/core/reviewPublicSurface.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewRefs.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Git/Ref State Extraction

Delete-list after this slice:

- Do not change default base order, commit resolution syntax, clean-worktree
  semantics, no-change fast path, unavailable-review wording, or review schema.
- Do not remove the shared git timeout, stdin detachment, or local-only git
  behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: non-git roots should still return unavailable; invalid
base refs should still return unavailable; identical clean refs should still
use the no-change report; dirty worktrees at identical refs should still be
reviewed instead of fast-pathed.

Kept change: one git/ref state helper module, one maintainability regression,
existing review behavior coverage, this persona note, and no public schema
change.

## Ninety-Second Slice Decision

Selected personas: OSS Maintainer and Agent-Orchestrating Engineer.

Reason: `src/mcp/server.ts` remains a high-churn production hotspot and is the
first integration boundary many agent clients touch. It should be easy to audit
the stdio server orchestration without reading the protocol-specific
initialize, tool, prompt, and resource handlers inline.

Smallest fix: move MCP request handler construction into
`serverHandlers.ts`; keep `server.ts` responsible for package version lookup,
lifecycle creation, raw message parsing, JSON-RPC dispatch, and stdio wiring.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "MCP request handlers"
npm run test -- tests/mcp/server.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/mcp/server.ts --format json
npm exec projscan -- file src/mcp/serverHandlers.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: MCP Request Handler Extraction

Delete-list after this slice:

- Do not change MCP method names, request params, response shapes, error codes,
  progress notifications, or tool content formatting.
- Do not change tool session recording, watcher startup timing, prompt/resource
  definitions, stdio behavior, or public CLI/MCP surface.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: missing tool, prompt, and resource params should keep the
same invalid-params responses; unknown tools should keep method-not-found;
tool exceptions should still return `isError: true` without cost or budget
sidecars; initialize should still start the watcher only through the lifecycle
boundary.

Kept change: one MCP handler module, one maintainability regression, existing
MCP behavior coverage, this persona note, and no public schema change.

## Ninety-Second Slice Decision

Selected personas: Platform/Release Owner and Agent-Orchestrating Engineer.

Reason: hotspot analysis is the planning signal used to choose future slices.
The analyzer should make it clear which files become candidates and which files
get measured line counts before scoring. Keeping extension filtering, max-byte
guardrails, churn/size ordering, and read limits inline made the high-churn
orchestrator harder to audit.

Smallest fix: move hotspot candidate selection and measured line-count
collection into `hotspotCandidates.ts`; keep `hotspotAnalyzer.ts` responsible
for git availability, churn loading, issue joins, hotspot construction,
ranking, and memory tagging.

Proof commands:

```bash
npm run test -- tests/core/hotspotAnalyzer.test.ts -t "candidate selection"
npm run test -- tests/core/hotspotAnalyzer.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json
npm exec projscan -- file src/core/hotspotCandidates.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Hotspot Candidate Extraction

Delete-list after this slice:

- Do not change code-extension eligibility, max line-read count, max read byte
  size, churn/size read ordering, hotspot limit handling, ranking, or score
  calculation.
- Do not change issue indexing, AST complexity preference, line estimate
  fallback, memory tagging, or public hotspot report schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: oversized source files should still be skipped as
candidates; high-churn files should still be prioritized for line reads;
unreadable files should still fall back to line estimates; files with zero risk
should still be excluded from ranked output.

Kept change: one hotspot candidate helper module, one maintainability
regression, existing hotspot behavior coverage, this persona note, and no
public schema change.

## Ninety-Second Slice Decision

Selected personas: Security-Conscious Reviewer and OSS Maintainer.

Reason: framework dataflow should deepen only where a request value can be
identified precisely and proven against a sink. Express `req.originalUrl` is a
request-controlled URL surface that can matter in SQL/log/search flows, but it
should not make every variable named `originalUrl` look dangerous.

Smallest fix: add `express.req.originalUrl` through request-parameter
member-reference matching, not broad bare-reference matching. Keep route-local
variables named `originalUrl` and non-route helpers quiet.

Proof commands:

```bash
npm run test -- tests/core/dataflow.test.ts -t "Express originalUrl"
npm run test -- tests/core/dataflow.test.ts tests/core/frameworkSources.test.ts tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/frameworkExpressSources.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Express Original URL Dataflow

Delete-list after this slice:

- Do not broaden Express source matching to bare `originalUrl` references.
- Do not change existing Express body/query/params/header/cookie/IP or accessor
  source labels, sink detection, bridge risk logic, or dataflow schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: `req.originalUrl` inside an Express route should surface
when it reaches a sink; a local variable named `originalUrl` inside a route and
a helper parameter with `originalUrl` outside a route should stay quiet.

Kept change: one additive Express source label, one positive dataflow fixture,
lookalike guards, existing framework/dataflow coverage, this persona note, and
no breaking schema change.

## Ninety-Second Slice Decision

Selected personas: Platform/Release Owner and Security-Conscious Reviewer.

Reason: preflight is the local release/review gate that turns health,
supply-chain, plugin, review, session, and coordination signals into agent
actions. Its largest reason builder mixed policy issue wording with every
other gate. Policy issue wording is security-sensitive and should be easy to
audit independently.

Smallest fix: move supply-chain and plugin policy reason formatting into
`preflightIssueReasons.ts`; keep `buildPreflightReasons` responsible for
combining policy reasons with changed-file, review, release-scale, session,
health, and coordination reasons.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "policy issue reason"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightIssueReasons.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Policy Reason Extraction

Delete-list after this slice:

- Do not change preflight reason order, severity, source, issue id, file,
  message text, tool routing, verdict logic, required checks, or release-scale
  sign-off behavior.
- Do not change plugin execution trust behavior, supply-chain analyzer output,
  review computation, changed-file detection, session evidence, or coordination
  evidence.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: supply-chain errors should still block; supply-chain
warnings should still caution; trusted plugin errors should still block and
untrusted preview-disabled plugins should still not execute.

Kept change: one preflight policy-reason helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## Ninety-Third Slice Decision

Selected personas: Platform/Release Owner and Agent-Orchestrating Senior
Engineer.

Reason: preflight is the compact reviewer gate agents rely on before commit and
merge. After policy wording moved out, the same orchestrator still owned
changed-file health, availability, and threshold reason formatting, keeping a
high-change review gate harder to audit.

Smallest fix: move changed-file reason construction into
`preflightChangedFileReasons.ts`; keep `buildPreflightReasons` responsible for
reason ordering across policy, changed-file, release-scale, review, session,
health, and coordination signals.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "changed-file reason formatting"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightChangedFileReasons.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Changed-File Reason Extraction

Delete-list after this slice:

- Do not change preflight reason order, severity, source, issue id, file,
  message text, tool routing, verdict logic, required checks, or release-scale
  sign-off behavior.
- Do not change changed-file detection, review computation, policy issue
  formatting, session evidence, health scoring, coordination evidence, or
  public report schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: changed-file health errors should still block before commit
or merge; changed-file health warnings and unavailable changed-file evidence
should still caution; release-scale threshold wording should still appear in
release-scale evidence.

Kept change: one preflight changed-file reason helper module, one
maintainability regression, existing preflight behavior coverage, this persona
note, and no public schema change.

## Ninety-Fourth Slice Decision

Selected personas: Platform/Release Owner and Security-Conscious Reviewer.

Reason: required checks are the reviewer-facing explanation of whether health,
supply-chain, changed-file, and review gates pass, warn, fail, or are
unavailable. Keeping that formatting inside the main preflight module made the
release/review gate harder to audit after the reason-formatting extractions.

Smallest fix: move required-check assembly into
`preflightRequiredChecks.ts`; keep preflight orchestration responsible for
collecting evidence and passing the same health, changed-file, review,
supply-chain, and release-scale inputs.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "required check formatting"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightRequiredChecks.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Required-Check Extraction

Delete-list after this slice:

- Do not change required-check names, statuses, reason text, order, or
  release-scale downgrade behavior.
- Do not change preflight reason ordering, verdict logic, evidence shape,
  changed-file detection, review computation, policy issue formatting, or
  public report schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: scale-only review blocks should still report the review
required check as `warn`; concrete review blocks should still report `fail`;
before-edit review should remain `unavailable`.

Kept change: one preflight required-check helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## Ninety-Fifth Slice Decision

Selected personas: Platform/Release Owner and Security-Conscious Reviewer.

Reason: release-scale evidence decides whether a large change is a manual
sign-off gate or whether concrete health, supply-chain, plugin, taint, or
dataflow blockers should keep preflight strict. That distinction is
reviewer-facing and security-sensitive enough to audit independently from the
main preflight orchestration.

Smallest fix: move release-scale detection, scale-only review interpretation,
concrete blocker detection, and sign-off explanation text into
`preflightReleaseScale.ts`; keep the preflight module responsible for gathering
inputs and attaching the returned evidence.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "release-scale evidence isolated"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightReleaseScale.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Release-Scale Extraction

Delete-list after this slice:

- Do not change release-scale detection, explanation text, concrete blocker
  suppression, manual sign-off wording, required-check downgrade behavior, or
  report schema.
- Do not change review computation, taint/dataflow blocker handling, plugin or
  supply-chain policy, changed-file thresholds, or preflight verdict logic.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: scale-only review blocks should still become manual
sign-off cautions only when there are no concrete health, supply-chain, plugin,
taint, or dataflow blockers; import-cycle review blocks should not be treated
as scale-only release risk.

Kept change: one preflight release-scale helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## Ninety-Sixth Slice Decision

Selected personas: Platform/Release Owner and Security-Conscious Reviewer.

Reason: review and taint reasons are the strongest preflight signals before
commit or merge. Keeping review block, review caution, review unavailable, and
taint wording inside the main reason orchestrator made it harder to audit why a
large release-scale review block is downgraded to warning while concrete taint
still blocks.

Smallest fix: move review-related reason construction into
`preflightReviewReasons.ts`; keep `buildPreflightReasons` responsible for
ordering policy, changed-file, release-scale, review, session, health, and
coordination reason groups.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "review reason formatting"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightReviewReasons.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Review-Reason Extraction

Delete-list after this slice:

- Do not change taint, review block, review caution, or review-unavailable
  reason order, severity, source, message text, or tool routing.
- Do not change release-scale review downgrade behavior, review computation,
  preflight verdict logic, required checks, evidence shape, or public report
  schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: new taint flows should still produce an error reason before
review-verdict reasons; release-scale review blocks should still become warning
reasons; unavailable review evidence outside before-edit mode should still
caution.

Kept change: one preflight review-reason helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## Ninety-Seventh Slice Decision

Selected personas: Security-Conscious Reviewer and Platform/Release Owner.

Reason: scoped/redacted evidence controls are a roadmap success signal, and
reviewers need proof that the controls work beyond `analyze`. The code already
applied controls to `doctor` and `ci`, but CLI coverage only proved analyze
SARIF/Markdown/HTML.

Smallest fix: add focused CLI regression coverage for `doctor --format json`
and `ci --format sarif` with `--report-scope src/private --redact-paths`,
including explicit checks that scoped and out-of-scope raw paths are absent.

Proof commands:

```bash
npm run test -- tests/cli/formatHandling.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Scoped Evidence CLI Coverage

Delete-list after this slice:

- Do not change report-control behavior, CLI flags, output schema, path
  redaction labels, scope filtering, or reporter APIs.
- Do not broaden this into new report formats, config schema changes, or
  release preparation.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: `doctor` JSON and `ci` SARIF should include
`reportControls` metadata, redact in-scope issue paths to stable labels, and
avoid leaking both scoped raw paths and out-of-scope raw paths.

Kept change: two CLI regression tests, a shared scoped-cycle fixture for the
format-handling suite, this persona note, and no public behavior change.

## Ninety-Eighth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: preflight evidence is what agents and reviewers inspect to distinguish
current worktree risk from remembered session context, release-scale risk,
coordination overlap, and policy findings. Keeping all evidence shaping in the
main preflight module kept a high-change gate difficult to review.

Smallest fix: move health, changed-file, review, session, risk-source, hotspot,
plugin, supply-chain, release-scale, and coordination evidence shaping into
`preflightEvidence.ts`; export one shared evidence truncation limit so the main
report-level truncation flag stays aligned with evidence payload truncation.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "evidence shaping isolated"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightEvidence.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Evidence Extraction

Delete-list after this slice:

- Do not change preflight evidence field names, remembered-session wording,
  current-worktree/session-memory split, truncation limit, or report schema.
- Do not change reason ordering, verdict logic, required checks, report
  controls, review computation, coordination computation, or plugin execution.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: large remembered sessions should still set truncated
session evidence; current Git/worktree evidence and remembered session context
should remain separate risk sources.

Kept change: one preflight evidence helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## Ninety-Ninth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: suggested next actions and tool-call hints are the handoff bridge from
preflight findings to the next safe local command. Keeping that projection in
the main preflight module made the gate harder to audit after evidence and
reason shaping were isolated.

Smallest fix: move suggested-action construction, deduping, and tool-call
projection into `preflightSuggestedActions.ts`; keep `computePreflight`
responsible for passing the current reasons, mode, and changed-file availability.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "suggested action shaping"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightSuggestedActions.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Suggested-Action Extraction

Delete-list after this slice:

- Do not change suggested action labels, commands, tool names, order, deduping,
  tool-call projection, or preflight report schema.
- Do not change reason generation, verdict logic, required checks, evidence
  shaping, coordination behavior, or release-scale sign-off behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: review/taint reasons should still suggest full review;
doctor/plugin/supply-chain reasons should still suggest doctor; unavailable
changed-file evidence outside before-edit should still suggest an explicit base
ref.

Kept change: one preflight suggested-action helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## One Hundredth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: contextual preflight reasons are the remaining mixed responsibility in
the main preflight reason orchestrator: remembered session hotspot risk,
project-health fallback risk, and multi-worktree coordination risk. Agents need
that context, but reviewers need the orchestrator to stay small enough to audit
reason order and severity without rereading every formatter.

Smallest fix: move session hotspot, changed-file-scope health fallback, and
coordination advisory reason construction into `preflightContextReasons.ts`;
keep `buildPreflightReasons` responsible for only ordering reason groups.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "contextual reason formatting"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightContextReasons.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Contextual-Reason Extraction

Delete-list after this slice:

- Do not change session hotspot, health fallback, or coordination reason
  wording, severity, tool names, order, or preflight report schema.
- Do not change changed-file detection, health scoring, session loading,
  hotspot analysis, coordination computation, verdict logic, required checks,
  evidence shaping, or suggested-action behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: conflicted coordination should remain warning-only and
caution coordination should remain info-only; neither path should become a hard
block without concrete policy or review findings.

Kept change: one preflight contextual-reason helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## One Hundred First Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Security-Conscious
Reviewer.

Reason: `src/core/review.ts` is a current bug-hunt hotspot and review is the
gate agents use before merge decisions. The highest-risk remaining review code
was not a new feature gap; it was the dense assembly of changed files, cycles,
risky functions, dependency/contract changes, taint/dataflow deltas, graph
evidence, and verdict inputs in the orchestrator.

Smallest fix: move derived finding assembly into `reviewFindings.ts`; keep
`computeReview` responsible for git/ref state, snapshot loading, no-change
handling, final report shape, and intent annotation.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "review finding assembly"
npm run test -- tests/core/review.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewFindings.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Finding-Assembly Extraction

Delete-list after this slice:

- Do not change review verdict inputs, package scoping, changed-file ordering,
  cycle classification, dependency/contract detection, taint/dataflow
  semantics, graph evidence, or public report schema.
- Do not change git/ref resolution, no-change handling, base/head snapshot
  behavior, worktree cleanup, or intent annotation.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: package-scoped reviews should still scope the diff before
all derived findings and verdict inputs are computed.

Kept change: one review finding helper module, one maintainability regression,
existing review behavior coverage, this persona note, and no public schema
change.

## One Hundred Second Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and OSS Maintainer /
MCP Adopter.

Reason: bug-hunt now points at `src/core/start.ts` as the top production
hotspot. `projscan start` is the first command many agents and maintainers see,
so its orchestrator should remain easy to audit while the report schema stays
stable.

Smallest fix: move final `StartReport` assembly, summary projection,
`mcpReady` evidence, optional handoff, and truncation flags into
`startReportBuilder.ts`; keep `computeStartReport` focused on collecting inputs
and choosing the current workflow.

Proof commands:

```bash
npm run test -- tests/core/start.test.ts -t "final report assembly"
npm run test -- tests/core/start.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/start.ts --format json
npm exec projscan -- file src/core/startReportBuilder.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Start Report-Assembly Extraction

Delete-list after this slice:

- Do not change `projscan start` report field names, summary text, evidence
  shape, optional handoff behavior, truncation behavior, or public schema.
- Do not change mode resolution, workflow selection, mission-control assembly,
  first-ten-minutes guidance, coordination hints, adoption gaps, or next-action
  ordering.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: `includeHandoff` should still be the only condition that
adds a workplan handoff payload, and truncated reports should still reflect
either workplan or quality truncation.

Kept change: one start report builder module, one maintainability regression,
existing start behavior coverage, this persona note, and no public schema
change.

## One Hundred Third Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and MCP Adopter.

Reason: bug-hunt now points at the MCP tool registry as a production watch
item. The registry is stable and low-complexity, so the right move is not to
change tool behavior; it is to separate static catalog data from lookup helpers
so future tool additions touch the catalog surface directly.

Smallest fix: move the static `McpTool[]` catalog into `toolCatalog.ts`; keep
`tools.ts` as the stable adapter exposing `getToolDefinitions`,
`getToolHandler`, and public MCP tool types.

Proof commands:

```bash
npm run test -- tests/mcp/server.test.ts -t "tool catalog"
npm run test -- tests/mcp/server.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/mcp/tools.ts --format json
npm exec projscan -- file src/mcp/toolCatalog.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: MCP Tool-Catalog Extraction

Delete-list after this slice:

- Do not change MCP tool names, order, handlers, input schemas, deprecation
  descriptions, public type exports, or server dispatch behavior.
- Do not add or remove tools, change CLI/MCP parity, alter manifest generation,
  or change token-budget behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: deprecated tools should still receive the same
description-prefix shaping through `getToolDefinitions`.

Kept change: one MCP tool catalog module, one maintainability regression,
existing MCP server coverage, this persona note, and no public schema change.

## One Hundred Fourth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Security-Conscious
Reviewer.

Reason: `src/core/review.ts` remained a bug-hunt production hotspot after
finding assembly was isolated. The next highest-risk responsibility was review
state resolution: repository readiness, ref/SHA resolution, no-change detection,
and unavailable-report shaping.

Smallest fix: move review state resolution into `reviewState.ts`; keep
`computeReview` focused on snapshot loading, diffing, finding assembly, final
available report shape, and intent annotation.

Proof commands:

```bash
npm run test -- tests/core/review.test.ts -t "review state resolution"
npm run test -- tests/core/review.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/review.ts --format json
npm exec projscan -- file src/core/reviewState.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review State-Resolution Extraction

Delete-list after this slice:

- Do not change non-git, unresolved-base, no-change, or base-snapshot failure
  report shapes, reason text, verdicts, or public schema.
- Do not change default-base selection, SHA resolution, worktree-clean checks,
  snapshot loading, finding assembly, package scoping, or intent annotation.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: no-change reports should still receive intent annotation
after state resolution, while unavailable reports should remain simple
unavailable payloads.

Kept change: one review state helper module, one maintainability regression,
existing review behavior coverage, this persona note, and no public schema
change.

## One Hundred Fifth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: after the review-state cleanup, `src/core/preflight.ts` remained one of
the highest-complexity production hotspots. The remaining review-specific work
inside preflight was review execution and review-result projection, which is
important for release-scale sign-off but not core preflight orchestration.

Smallest fix: move review execution, before-edit skip behavior, unavailable
reason capture, summary joining, and taint/dataflow count projection into
`preflightReviewEvidence.ts`; keep `computePreflight` responsible for composing
the final preflight report.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "review evidence collection"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightReviewEvidence.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Review-Evidence Extraction

Delete-list after this slice:

- Do not change before-edit review skip behavior, review unavailable reason
  text, review summary joining, taint/dataflow count projection, or public
  preflight schema.
- Do not change preflight verdict logic, reason order, required checks,
  release-scale sign-off behavior, evidence shaping, or suggested actions.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: unavailable review reports should still feed the same
warning path, and available review reports should still expose taint/dataflow
counts for release-scale and evidence consumers.

Kept change: one preflight review-evidence helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## One Hundred Sixth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: `src/core/preflight.ts` remained a production hotspot after review
evidence was isolated. Changed-file evidence is a separate input boundary: it
decides whether current worktree scope is available and feeds reason,
required-check, evidence, and action shaping downstream.

Smallest fix: move changed-file detection, before-edit skip behavior,
`getChangedFiles` projection, and error fallback shaping into
`preflightChangedFiles.ts`; keep `computePreflight` focused on composing
preflight inputs.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "changed-file evidence collection"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightChangedFiles.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Changed-File Extraction

Delete-list after this slice:

- Do not change before-edit changed-file skip behavior, changed-file count,
  file list, base-ref propagation, unavailable reason text, or public preflight
  schema.
- Do not change reason order, required checks, evidence shaping, suggested
  actions, release-scale behavior, review behavior, or coordination behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: changed-file detection failures should still produce the
same unavailable evidence and warning path outside `before_edit`.

Kept change: one preflight changed-file helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## One Hundred Seventh Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: `projscan hotspots --format json` ranked `src/core/hotspotAnalyzer.ts`
as the top production hotspot after the preflight slices. This module feeds the
bug-hunt loop, preflight context, file inspection, review snapshots, and several
MCP tools, so keeping it small and reviewable improves trust in every later
roadmap slice.

Smallest fix: move pure per-file hotspot assembly into `hotspotBuilder.ts`,
including author summary shaping, date recency calculation, line/CC/coverage
normalization, score inputs, reasons, and the final `FileHotspot` object.

Proof commands:

```bash
npm run test -- tests/core/hotspotAnalyzer.test.ts -t "per-file hotspot assembly"
npm run test -- tests/core/hotspotAnalyzer.test.ts
npm run test -- tests/core/hotspotIssueLinking.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/hotspotAnalyzer.ts --format json
npm exec projscan -- file src/core/hotspotBuilder.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Hotspot Builder Extraction

Delete-list after this slice:

- Do not change hotspot score formulas, reason wording, author share rounding,
  bus-factor threshold, coverage handling, issue ID propagation, recency logic,
  or public hotspot schema.
- Do not change git churn collection, candidate filtering, line-read limits,
  issue-to-file linking, memory acceptance tagging, or report sorting.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: a graph-parsed file should still use AST cyclomatic
complexity, while unparsed and non-adapter files should keep falling back to
line counts.

Kept change: one hotspot builder helper module, one maintainability regression,
existing hotspot behavior coverage, this persona note, and no public schema
change.

## One Hundred Eighth Slice Decision

Selected personas: OSS Maintainer Evaluating MCP Adoption and
Security-Conscious Reviewer.

Reason: `src/core/languages/pythonManifests.ts` remained a production hotspot
on the Python upgrade-intelligence roadmap line. The file still mixed the
detector with setuptools-specific manifest reads and `install_requires`
parsing, even though lockfiles, requirements, roots, pyproject parsing, and
project evidence were already separated.

Smallest fix: move `setup.py` and `setup.cfg` evidence reading plus dependency
parsing into `pythonSetuptools.ts`; keep `detectPythonProject` responsible for
orchestrating manifest evidence, package roots, and lockfile detection.

Proof commands:

```bash
npm run test -- tests/core/languages/pythonManifests.test.ts -t "setuptools manifest parsing"
npm run test -- tests/core/languages/pythonManifests.test.ts
npm run test -- tests/core/upgradePreview.test.ts tests/mcp/pythonUpgradeFallback.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/languages/pythonManifests.ts --format json
npm exec projscan -- file src/core/languages/pythonSetuptools.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Python Setuptools Extraction

Delete-list after this slice:

- Do not change `setup.py` or `setup.cfg` dependency names, version specs,
  source names, line numbers, scopes, or manifest file ordering.
- Do not change pyproject parsing, root requirements evidence, lockfile
  precedence, package-root inference, Python project detection gating, or
  public Python project types.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: pinned requirement and lockfile evidence should still drive
upgrade previews exactly as before; setuptools extraction is only a detector
boundary cleanup.

Kept change: one setuptools helper module, one maintainability regression,
existing Python manifest and upgrade-preview coverage, this persona note, and
no public schema change.

## One Hundred Ninth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: after the Python and hotspot slices, `src/core/preflight.ts` returned
to the top production hotspot list. The remaining private collection helpers
for session memory, hotspot analysis, and swarm coordination are local evidence
inputs; they should be isolated from the preflight report orchestrator so
reviewers can distinguish evidence collection from verdict/report shaping.

Smallest fix: move `safeSession`, `safeHotspots`, and `safeCoordination` into
`preflightLocalEvidence.ts`; keep `computePreflight` responsible for composing
configuration, scan, issues, evidence inputs, reasons, checks, actions, and the
final report.

Proof commands:

```bash
npm run test -- tests/core/preflight.test.ts -t "local evidence collection"
npm run test -- tests/core/preflight.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/preflight.ts --format json
npm exec projscan -- file src/core/preflightLocalEvidence.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Local-Evidence Extraction

Delete-list after this slice:

- Do not change remembered-session ordering, event counts, touched-file
  truncation behavior, hotspot limit, hotspot unavailable fallback, or
  coordination availability filtering.
- Do not change preflight verdicts, summary text, reason ordering, required
  checks, suggested actions, release-scale sign-off behavior, or public
  preflight schema.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: same-file worktree collision evidence should remain a
warning/caution signal, never an error/block signal.

Kept change: one preflight local-evidence helper module, one maintainability
regression, existing preflight behavior coverage, this persona note, and no
public schema change.

## One Hundred Tenth Slice Decision

Selected personas: Agent-Orchestrating Senior Engineer and Platform/Release
Owner.

Reason: after preflight local-evidence extraction, `src/core/ast.ts` became the
highest-ranked production hotspot. The file already delegates traversal,
module signals, body signals, function naming, and function collection; parser
setup remained as a separate concern with high fan-in risk.

Smallest fix: move parseability checks, Babel parser plugin selection, parse
execution, and parse-error shaping into `astParser.ts`; keep `parseSource`
responsible for orchestrating imports, exports, call sites, file-level
complexity, and per-function metadata.

Proof commands:

```bash
npm run test -- tests/core/ast.functions.test.ts -t "Babel parser setup"
npm run test -- tests/core/ast.functions.test.ts tests/core/ast.test.ts tests/core/ast.cyclomatic.test.ts tests/core/ast.references.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/ast.ts --format json
npm exec projscan -- file src/core/astParser.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: AST Parser Setup Extraction

Delete-list after this slice:

- Do not change parseable extensions, Babel parser options/plugins,
  parse-error reason format/truncation, or public `parseSource` / `isParseable`
  exports.
- Do not change import/export/call-site extraction, cyclomatic complexity,
  function extraction, or fallback behavior.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: malformed source should still return `ok: false` with a
parse error reason, while TSX/JSX still gets the JSX plugin and TypeScript
extensions still get the TypeScript plugin.

Kept change: one AST parser helper module, one maintainability regression,
existing AST behavior coverage, this persona note, and no public schema
change.

## One Hundred Eleventh Slice Decision

Selected personas: Security-Conscious Reviewer and Agent-Orchestrating Senior
Engineer.

Reason: `src/core/taint.ts` remained a production hotspot with security review
impact. The main report builder still mixed graph traversal with source/sink
hit selection and default false-positive filters for child-process, database,
and env passthrough cases.

Smallest fix: move source matching, sink matching, child-process import
filtering, database member/helper/alias filtering, JavaScript-file detection,
and env passthrough suppression into `taintMatching.ts`; keep `computeTaint`
responsible for effective config, framework-source delegation, graph indexing,
BFS traversal, flow shaping, sorting, and truncation reporting.

Proof commands:

```bash
npm run test -- tests/core/taint.test.ts -t "source and sink matching"
npm run test -- tests/core/taint.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/taint.ts --format json
npm exec projscan -- file src/core/taintMatching.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Taint Matching Extraction

Delete-list after this slice:

- Do not change default or custom taint source/sink semantics, framework
  request-source detection, same-function flows, BFS traversal, dedupe keys,
  truncation flags, or `maxDepth`.
- Do not change child-process import filtering, database member/helper/alias
  filtering, JavaScript-like file detection, or env passthrough suppression.
- Do not change public `computeTaint`, `TaintReport`, `TaintFlow`,
  `DEFAULT_TAINT_SOURCES`, or `DEFAULT_TAINT_SINKS` exports.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: `process.env` passed through as a child-process `env`
option should stay suppressed unless a concrete `process.env.NAME` read or
custom source/sink config makes it intentional.

Kept change: one taint matching helper module, one maintainability regression,
existing taint behavior coverage, this persona note, and no public schema
change.

## One Hundred Twelfth Slice Decision

Selected personas: Platform/Release Owner and Agent-Orchestrating Senior
Engineer.

Reason: after the taint matching extraction, `src/core/codeGraph.ts` remained
the highest-complexity production hotspot with a clear private boundary. The
file still mixed graph parsing/index orchestration with per-function fan-in and
fan-out metric calculation.

Smallest fix: move fan-in, fan-out, and qualified-name bare-name matching into
`codeGraphFanMetrics.ts`; keep `codeGraph.ts` responsible for file parsing,
adapter context preparation, import/export index rebuilding, incremental
updates, and public query APIs.

Proof commands:

```bash
npm run test -- tests/core/codeGraph.fanIn.test.ts -t "fan metric computation"
npm run test -- tests/core/codeGraph.fanIn.test.ts tests/core/codeGraph.fanOut.test.ts tests/core/codeGraph.incremental.test.ts tests/core/codeGraph.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/codeGraph.ts --format json
npm exec projscan -- file src/core/codeGraphFanMetrics.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Code Graph Fan Metrics Extraction

Delete-list after this slice:

- Do not change `GraphFile`, `CodeGraph`, `buildCodeGraph`,
  `incrementallyUpdateGraph`, `toPackageName`, or query API exports.
- Do not change import resolution, local star re-export expansion, symbol
  definition indexing, package importer indexing, or incremental parse/update
  behavior.
- Do not change fan-in self-file subtraction, fan-out distinct callee counting,
  self-recursion suppression, or class-method bare-name matching.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: incremental graph updates should still recompute fan-in and
fan-out after edited files are re-parsed and cross-file indexes are rebuilt.

Kept change: one code graph fan-metrics helper module, one maintainability
regression, existing fan-in/fan-out and incremental graph coverage, this persona
note, and no public API change.

## One Hundred Thirteenth Slice Decision

Selected personas: OSS Maintainer Evaluating MCP Adoption and Platform/Release
Owner.

Reason: `src/core/fileInspector.ts` remained a production hotspot and still
mixed file inspection orchestration with graph cache loading plus graph-backed
import/export shaping. Those details are review noise for an inspector that
should primarily compose file access, scan/issues, graph metrics, hotspots, and
the final inspection record.

Smallest fix: move inspection graph loading, cache save/load, import shaping,
and export shaping into `fileInspectionGraph.ts`; keep `inspectFile`
responsible for file access, scan/issue lookup, purpose/issues, hotspot lookup,
graph metrics, and final report assembly.

Proof commands:

```bash
npm run test -- tests/core/fileInspector.test.ts -t "graph loading and import/export shaping"
npm run test -- tests/core/fileInspector.test.ts
npm run typecheck
npm run lint
npm run build
npm exec projscan -- file src/core/fileInspector.ts --format json
npm exec projscan -- file src/core/fileInspectionGraph.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: File Inspection Graph Extraction

Delete-list after this slice:

- Do not change `inspectFile`, `explainFile`, `InspectOptions`, `inferPurpose`,
  or `detectFileIssues` exports.
- Do not change path safety, symlink handling, missing-file behavior, cached
  graph reuse, graph-backed JavaScript/Python imports/exports, hotspot lookup,
  related issue filtering, or graph metrics.
- Do not reintroduce removed regex import/export extractors.
- Do not add release, publish, tag, push, version, dependency, network, or
  secret-reading behavior.

Reviewer edge case: when a caller supplies `options.graph`, the inspector should
still use that graph directly and avoid cache load/build/save work.

Kept change: one file inspection graph helper module, one maintainability
regression, existing file inspector behavior coverage, this persona note, and no
public API change.

## One Hundred Fourteenth Slice Decision

Selected personas: Platform/Release Owner and OSS Maintainer Evaluating MCP
Adoption.

Reason: `scripts/check-stability.mjs` was the next production-ish hotspot and
guards the public stable surface that release owners and MCP adopters rely on.
Its comparison rules were embedded in top-level CLI code, so importing it for
focused tests immediately exited the test process.

Smallest fix: move pure stable-surface shaping and comparison into
`stability-surface.mjs`; keep `check-stability.mjs` responsible for manifest
IO, baseline writes, CLI formatting, and exit codes.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/scripts/stabilityCheck.test.ts
npm exec agentflight -- verify npm run test -- tests/scripts/stabilityCheck.test.ts tests/scripts/releaseCheck.test.ts tests/scripts/graphCorpusCheck.test.ts
npm exec agentflight -- verify npm run check:stability
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file scripts/check-stability.mjs --format json
npm exec projscan -- file scripts/stability-surface.mjs --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Stability Surface Comparison Extraction

Delete-list after this slice:

- Do not change stable CLI command names, exit-code meanings, MCP tool/argument
  compatibility rules, allowed-addition reporting, baseline path, or failure
  wording.
- Do not update `stability-baseline.json`, run `--update`, bump versions, tag,
  publish, push, or cut a release.
- Do not add dependency, network, telemetry, daemon, or secret-reading behavior.

Reviewer edge case: importing `check-stability.mjs` in Vitest should not call
`process.exit`, while running `node scripts/check-stability.mjs` should still
exit nonzero on stable-surface regressions.

Kept change: one stability comparison helper module, one focused script test,
existing script/stability behavior coverage, this persona note, and no release
or baseline update.

## One Hundred Fifteenth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer Evaluating
MCP Adoption.

Reason: `src/core/intentRouter.ts` remained the largest production hotspot, and
dependency/coupling routing is an adoption-sensitive surface because agents ask
for package importers, dependency health, audit, workspace ownership, and
architecture risk before choosing tools.

Smallest fix: move dependency, audit, package lookup, workspace, bloat, cycle,
and coupling route-signal helpers into `intentRouterDependencySignals.ts`;
leave route catalog data, scoring, confidence, and dispatch composition inside
`intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterDependencySignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Dependency Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, route tool IDs, CLI command strings, confidence
  scoring, `routeIntent`, or public route result shape.
- Do not change dependency/audit/workspace/package/coupling keyword semantics
  except by moving the existing cohesive checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: package lookup questions with file-path-like input should
still avoid the generic package dependency lookup route when `hasFilePathTarget`
is true.

Kept change: one dependency route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Sixteenth Slice Decision

Selected personas: Security-Conscious Reviewer and Platform/Release Owner.

Reason: evidence-pack and review routing decide how reviewers get PR summaries,
owner routing, and security-review guidance. Keeping those signals buried inside
the large intent router made review harder for the people relying on handoff
evidence.

Smallest fix: move evidence-pack and review keyword helpers into
`intentRouterReviewSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "review and evidence keyword routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterReviewSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Review Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, evidence-pack route entries, review route
  entries, route confidence scoring, `routeIntent`, or public route result shape.
- Do not change PR-summary, reviewer-routing, changed-file-owner, readiness, or
  security-review keyword semantics except by moving the existing cohesive
  checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "who owns changed files" should still route through the
evidence-pack owner path, while generic "review security changes" should still
match review only when PR/review context exists.

Kept change: one review route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Seventeenth Slice Decision

Selected personas: Security-Conscious Reviewer and Agent-Orchestrating Engineer.

Reason: dataflow and privacy-check routing decide whether security questions
land on the right local analysis tool. Those checks need to be easy to inspect
without requiring reviewers to scan the full intent router.

Smallest fix: move dataflow and privacy keyword helpers into
`intentRouterSecuritySignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "dataflow and privacy keyword routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSecuritySignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Security Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, dataflow route entries, privacy-check route
  entries, route confidence scoring, `routeIntent`, or public route result shape.
- Do not change dataflow/security/privacy/trust-boundary keyword semantics
  except by moving the existing cohesive checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: `auth bypass risk` should still route through dataflow
context, while `does projscan read .env values?` should still route through the
privacy-check trust-boundary path.

Kept change: one security route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Eighteenth Slice Decision

Selected personas: Platform/Release Owner and Agent-Orchestrating Engineer.

Reason: infrastructure artifact search routing helps agents distinguish
deployment/config lookups from release-train intent. That distinction matters
for local-first planning and for avoiding accidental release workflows.

Smallest fix: move infrastructure artifact search matching into
`intentRouterSearchInfraSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "infra artifact search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchInfraSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Infra Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, release-train route
  entries, route confidence scoring, `routeIntent`, or public route result shape.
- Do not change Docker, orchestration, IaC, hosted-config, or GitHub workflow
  deployment keyword semantics except by moving the existing cohesive checks
  into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: deployment artifact lookup language should still suppress
release-train routing when it is really asking where Docker/Kubernetes/IaC or
hosted deployment config lives.

Kept change: one infra search route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Nineteenth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: UI interaction search routing helps agents find existing form, state,
shortcut, modal, i18n, aria, and focus-trap behavior without turning lookup
questions into implementation plans. Maintainers also need this matcher outside
the main router hotspot so route behavior remains reviewable.

Smallest fix: move UI interaction search matching into
`intentRouterSearchUiSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "UI interaction search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchUiSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: UI Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, route confidence scoring,
  `routeIntent`, or public route result shape.
- Do not change UI interaction keyword semantics except by moving the existing
  cohesive checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is the empty results state rendered"
should still route as code search, while "add empty results state" should stay
out of the UI interaction search matcher.

Kept change: one UI search route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Twentieth Slice Decision

Selected personas: Agent-Orchestrating Engineer and Platform/Release Owner.

Reason: reliability lookup routing helps agents find existing retry, timeout,
rate-limit, cache, idempotency, signature, circuit-breaker, and debounce
behavior without creating work. Platform owners need these lookups to stay
separate from release-train or regression-planning paths unless the user is
actually asking for release or failure investigation.

Smallest fix: move reliability search matching into
`intentRouterSearchReliabilitySignals.ts`; leave route catalog data, route
scoring, confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "reliability search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchReliabilitySignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Reliability Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, regression-plan route
  entries, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change reliability keyword semantics except by moving the existing
  cohesive checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where are webhook signatures verified"
should still route as code search, while "add retry backoff" should stay out of
the reliability search matcher.

Kept change: one reliability search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty First Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: style-system lookup routing helps agents find existing design-token,
Tailwind, CSS, dark-mode, breakpoint, and palette behavior without turning
lookup questions into implementation plans. Maintainers need that matcher to be
reviewable without scanning the full intent-router hotspot.

Smallest fix: move style-system search matching into
`intentRouterSearchStyleSignals.ts`; leave route catalog data, route scoring,
confidence, dispatch composition, and regression-failure routing inside
`intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "style-system search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchStyleSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Style-System Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, regression failure route
  entries, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change style-system keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where are design tokens defined" should
still route as code search, while "why is dark mode broken" should continue to
use the existing regression failure path rather than the style search matcher.

Kept change: one style-system search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Second Slice Decision

Selected personas: Agent-Orchestrating Engineer and Platform/Release Owner.

Reason: integration lookup routing helps agents find existing external-service,
SDK/API client, HTTP/fetch, email, S3, GraphQL, and websocket behavior without
creating implementation work. Platform owners also need GitHub workflow language
to stay out of this matcher so CI/deployment lookup routing remains distinct.

Smallest fix: move integration search matching into
`intentRouterSearchIntegrationSignals.ts`; leave route catalog data, route
scoring, confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "integration search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchIntegrationSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Integration Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, GitHub workflow lookup
  routing, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change integration keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "find the Stripe webhook handler" should
still route as code search, while GitHub Actions/workflow lookup language should
remain outside the integration search matcher.

Kept change: one integration search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Third Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: API contract lookup routing helps agents find existing OpenAPI,
Swagger, tRPC, GraphQL, protobuf, and gRPC surfaces without changing public
contracts or creating implementation work. Maintainers need this route logic
separate from the main hotspot because contract language is easy to confuse with
public API review.

Smallest fix: move API contract search matching into
`intentRouterSearchApiSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "API contract search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchApiSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: API Contract Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, public contract review
  routing, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change API contract keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is OpenAPI spec defined" should still
route as code search, while "what are the public contracts" should continue to
use the public-contract understanding path.

Kept change: one API contract search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Fourth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: communication artifact lookup routing helps agents find existing email
templates, email copy, push notification copy, SMS templates, receipt
artifacts, and invoice PDFs without creating implementation work. Maintainers
need sensitive/security wording to remain outside this search matcher so
privacy/security routing stays distinct.

Smallest fix: move communication artifact search matching into
`intentRouterSearchCommunicationSignals.ts`; leave route catalog data, route
scoring, confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "communication artifact search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchCommunicationSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Communication Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, privacy/security routing,
  route confidence scoring, `routeIntent`, or public route result shape.
- Do not change communication artifact keyword semantics except by moving the
  existing cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is welcome email template" should
still route as code search, while "where is PII logged in email" should stay
out of the communication search matcher and remain available to
privacy/security routing.

Kept change: one communication artifact search route-signal helper module, one
router boundary regression, existing route/start behavior coverage, this
persona note, and no public API change.

## One Hundred Twenty Fifth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: state-management lookup routing helps agents find existing Redux,
Zustand, Jotai, Recoil, context-provider, query-hook, and React Query behavior
without turning lookup questions into implementation work. Maintainers need
sensitive token, password, customer, and privacy wording to remain outside this
matcher so security and privacy routing stays distinct.

Smallest fix: move state-management search matching into
`intentRouterSearchStateSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "state management search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchStateSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: State-Management Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, privacy/security routing,
  route confidence scoring, `routeIntent`, or public route result shape.
- Do not change state-management keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "find Redux slice for cart" should still
route as code search, while "where are customer tokens stored" should stay out
of the state-management search matcher and remain available to privacy/security
routing.

Kept change: one state-management search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Sixth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: domain workflow lookup routing helps agents find existing password
reset, invite, onboarding, CSV export, audit log, refund, and subscription
renewal behavior without turning lookup questions into implementation work.
Maintainers need these workflow words to stay reviewable outside the main
intent-router hotspot.

Smallest fix: move domain workflow search matching into
`intentRouterSearchDomainSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "domain workflow search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchDomainSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Domain Workflow Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, workflow planning
  routing, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change domain workflow keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is password reset handled" should
still route as code search, while "implement password reset" should stay out of
the domain workflow search matcher and continue to route as implementation
planning.

Kept change: one domain workflow search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Seventh Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: frontend page lookup routing helps agents find existing settings,
billing, checkout, dashboard, admin, route-segment, not-found, and 404 page
behavior without turning lookup questions into implementation work. Maintainers
need production/failure wording to remain outside this matcher so regression
and failure investigation routing stays distinct.

Smallest fix: move frontend page search matching into
`intentRouterSearchPageSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "frontend page search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchPageSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Frontend Page Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, regression failure
  routing, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change frontend page keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is /settings page rendered" should
still route as code search, while "why is /settings returning 404" should stay
out of the frontend page search matcher and continue to use failure routing.

Kept change: one frontend page search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Eighth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: tooling config lookup routing helps agents find existing Vite, Vitest,
Jest, Babel, Webpack, tsconfig, TypeScript alias, package-manager, workspace,
and lockfile behavior without turning lookup questions into dependency or
implementation work. Maintainers need update/upgrade/remove/failure wording to
stay outside this matcher so dependency and regression routing stays distinct.

Smallest fix: move tooling config search matching into
`intentRouterSearchToolingSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "tooling config search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchToolingSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Tooling Config Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, dependency routing,
  regression failure routing, route confidence scoring, `routeIntent`, or
  public route result shape.
- Do not change tooling config keyword semantics except by moving the existing
  cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is Vitest config" should still route
as code search, while "why is vitest failing" should stay out of the tooling
config search matcher and continue to use regression routing.

Kept change: one tooling config search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Twenty Ninth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: navigation/layout lookup routing helps agents find existing sidebar nav,
breadcrumb, page-title, metadata, and Next/dashboard layout behavior without
turning lookup questions into implementation work. Maintainers need this search
matcher reviewable without scanning the full intent-router hotspot.

Smallest fix: move navigation layout search matching into
`intentRouterSearchNavigationSignals.ts`; leave route catalog data, route
scoring, confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "navigation layout search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchNavigationSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Navigation Layout Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, navigation planning
  routing, route confidence scoring, `routeIntent`, or public route result
  shape.
- Do not change navigation/layout keyword semantics except by moving the
  existing cohesive search checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: questions like "where is sidebar nav item for billing"
should still route as code search, while "add sidebar nav item" should stay out
of the navigation layout search matcher and continue to route as implementation
planning.

Kept change: one navigation layout search route-signal helper module, one
router boundary regression, existing route/start behavior coverage, this
persona note, and no public API change.

## One Hundred Thirtieth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: PR-diff routing helps agents answer commit-message, change summary, PR
size, branch freshness, and branch comparison questions from structural diff
evidence without sending every PR-related phrase to full review. Maintainers need
the matcher isolated because it has several overlap guards with evidence-pack,
dependency-bloat, branch sync, collision, and session-context routing.

Smallest fix: move PR-diff keyword matching into
`intentRouterPrDiffSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "PR diff keyword routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterPrDiffSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: PR Diff Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, PR-diff route entries, evidence-pack routing,
  review routing, dependency-bloat routing, branch-sync routing, route
  confidence scoring, `routeIntent`, or public route result shape.
- Do not change PR-diff keyword semantics except by moving the existing matcher
  and its private PR-size/branch-sync guards into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "write a commit message for these changes" should still
route to `projscan_pr_diff`, while "what should I tell my team about this
change" should stay with evidence-pack routing and "what changed while I was
away" should stay led by session context.

Kept change: one PR-diff route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Thirty First Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: preflight routing helps agents choose the local safety gate for
ready/risk questions and for rebase or merge-conflict recovery, without
confusing post-conflict test planning or PR-diff comparisons. Maintainers need
these safety-gate phrases isolated because they are high-leverage routing
guards near review, hotspot, and branch-change paths.

Smallest fix: move preflight ready, risk, and branch-recovery matching into
`intentRouterPreflightSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "preflight route routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterPreflightSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Preflight Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, preflight route entries, PR-diff routing,
  hotspot routing, regression planning, route confidence scoring, `routeIntent`,
  or public route result shape.
- Do not change preflight keyword semantics except by moving the existing ready,
  risk, and branch-recovery checks into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "rebase went wrong" and "resolve merge conflicts" should
still route to `projscan_preflight`, while "what should I test after resolving
conflicts" should stay led by regression planning.

Kept change: one preflight route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Thirty Second Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: planning routing helps agents ask where to put a feature, endpoint,
database migration, API change, documentation update, state-management change,
or domain workflow without dropping into generic search. Maintainers need the
adjacent planning helpers moved together because `featurePlacementContextMatches`
delegates to the specialized planning checks.

Smallest fix: move the planning helper group into
`intentRouterPlanningSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "planning route routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterPlanningSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Planning Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, understand route entries, dataflow routing,
  search routing, regression planning, route confidence scoring, `routeIntent`,
  or public route result shape.
- Do not change planning keyword semantics except by moving the existing
  feature-placement and specialized planning checks into the helper module.
- Do not split off new behavior for navigation, style-system, docs, database,
  API, data-access, state-management, or domain-workflow planning.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "where should I add a new endpoint" and "what docs should I
update for this change" should still route to `projscan_understand`, while "add
tests for auth" should stay with regression planning.

Kept change: one planning route-signal helper module, one router boundary
regression, existing route/start behavior coverage, this persona note, and no
public API change.

## One Hundred Thirty Third Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: repo setup and orientation routing helps agents ask how to run the app,
which scripts exist, how to set up local services or migrations, which config or
env vars are needed, and where to start reading a repo. Maintainers also need
these helpers isolated because script and setup matchers are blockers for
verification, search, and test-data routing.

Smallest fix: move repo setup, local-service setup, database setup,
npm/package-script discovery, repo config, and repo orientation matching into
`intentRouterRepoSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "repo setup and orientation routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterRepoSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Repo Setup And Orientation Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, understand route entries, start/setup routing,
  package-script discovery, search routing, verification planning, route
  confidence scoring, `routeIntent`, or public route result shape.
- Do not change repo setup/orientation keyword semantics except by moving the
  existing matchers into the helper module.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "what command starts the dev server", "which script runs
e2e tests", and "what env vars does this repo need" should keep their existing
understand/start routing, while failure phrases like "dev server is failing"
should stay out of setup discovery.

Kept change: one repo setup/orientation route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.

## One Hundred Thirty Fourth Slice Decision

Selected personas: Agent-Orchestrating Engineer and OSS Maintainer.

Reason: test-data lookup routing helps agents find existing seed data, fixtures,
mocks, factories, and stories without turning lookup questions into test-writing
or database setup work. Maintainers need this matcher isolated because it relies
on repo setup and package-script blockers to avoid stealing setup commands.

Smallest fix: move test-data search matching into
`intentRouterSearchTestSignals.ts`; leave route catalog data, route scoring,
confidence, and dispatch composition inside `intentRouter.ts`.

Proof commands:

```bash
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts -- -t "test-data search routing"
npm exec agentflight -- verify npm run test -- tests/core/intentRouter.test.ts tests/core/startRouteActions.test.ts tests/core/startMode.test.ts tests/core/start.test.ts
npm exec agentflight -- verify npm run typecheck
npm exec agentflight -- verify npm run lint
npm exec agentflight -- verify npm run build
npm exec projscan -- file src/core/intentRouter.ts --format json
npm exec projscan -- file src/core/intentRouterSearchTestSignals.ts --format json
npm exec projscan -- bug-hunt --format json
```

## Review Guardrails: Test-Data Search Route Signals Extraction

Delete-list after this slice:

- Do not change `ROUTE_CATALOG`, search route entries, repo setup routing,
  package-script discovery, database setup routing, regression planning, route
  confidence scoring, `routeIntent`, or public route result shape.
- Do not change test-data keyword semantics except by moving the existing
  matcher and preserving its setup/script blockers through
  `intentRouterRepoSignals.ts`.
- Do not add release, publish, tag, push, version, dependency, network,
  telemetry, daemon, or secret-reading behavior.

Reviewer edge case: "find fixtures for checkout" and "where is seed data
defined" should still route to search, while "how do I run migrations locally"
should stay with setup/understand routing and "add tests for auth" should stay
with regression planning.

Kept change: one test-data search route-signal helper module, one router
boundary regression, existing route/start behavior coverage, this persona note,
and no public API change.
