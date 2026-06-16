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
