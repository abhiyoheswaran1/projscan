export const FIXED_ROUTE_CRITERIA: Record<string, string[]> = {
  projscan_release_train: [
    'Release train readiness has no blockers before packaging or publishing continues.',
    'Changelog, package, SBOM, and provenance evidence are reviewed before a release handoff.',
  ],
  projscan_bug_hunt: [
    'Bug-hunt findings are triaged by severity with a first fix candidate selected.',
    'The selected fix has a runnable verification command before editing starts.',
  ],
  projscan_workplan: [
    'The workplan identifies the first safe implementation or review step before edits begin.',
    'The selected action has a focused verification command before handoff.',
  ],
  projscan_agent_brief: [
    'The agent brief summarizes focus items, repo context, guardrails, and suggested next actions for the next developer.',
    'The handoff includes enough proof commands for the next agent to resume without rerunning broad discovery.',
  ],
  projscan_session: [
    'Remembered touched files and recent session events are reviewed before resuming work.',
    'The current worktree preflight is rerun after session context is reviewed, so stale memory does not override live risk.',
  ],
  projscan_coordinate: [
    'Coordination readiness, collisions, claims, and merge order are reviewed before parallel work continues.',
    'Any conflicted files, contended claims, or merge-order blockers have an owner or follow-up command before editing resumes.',
  ],
  projscan_privacy_check: [
    'Telemetry state, offline mode, scan root, ignored-file handling, .env content policy, plugin execution, local writes, and network-capable endpoints are reviewed.',
    'Any required trust-boundary change is made explicitly before broader analysis or report sharing continues.',
  ],
  projscan_quality_scorecard: [
    'Quality dimensions, top risks, and verification commands are reviewed before choosing the next task.',
    'The developer knows whether health, security, tests, maintainability, or coordination needs attention first.',
  ],
  projscan_review: [
    'The structural PR review reports a verdict and identifies any risk that needs owner follow-up.',
    'Review, preflight, or evidence-pack follow-up is chosen before the branch is handed to reviewers.',
  ],
  projscan_evidence_pack: [
    'The evidence pack produces a paste-ready PR comment with verdict, top risks, owner routing, and next commands.',
    'The reviewer-facing comment is validated before it is shared or used for approval.',
  ],
  projscan_feedback_intake: [
    'The raw feedback is classified and preserved before any product change starts.',
    'The generated AgentLoop task command is copied or run so the feedback becomes a bounded implementation slice.',
    'The feedback-intake suggested verification command is attached to the task or handoff.',
  ],
  projscan_analyze: [
    'The scoped analysis, health, and CI artifacts are generated with path redaction enabled before sharing outside the repo.',
    'The reviewer can correlate redacted-path-N labels without seeing raw repo structure.',
  ],
  projscan_doctor: [
    'Dead code, unused exports, lint, dependency, security, and config issues are reviewed before cleanup starts.',
    'Any issue chosen for cleanup has a fix-suggest, impact, or verification follow-up before files are deleted.',
  ],
  projscan_prove: [
    'The agent has a saved Proof Contract with allowed files, forbidden files, and required proof commands before editing.',
    'The completed change has a Proof Receipt with scope, proof replay, risk delta, and reviewer decision before handoff.',
  ],
  projscan_fix_suggest: [
    'A concrete fix suggestion is produced for the selected issue id.',
    'The suggestion names the file, fix instruction, and verification step before editing starts.',
  ],
  projscan_explain_issue: [
    'A deep issue explanation is produced for the selected issue id.',
    'The explanation identifies surrounding code, related issues, similar fixes, and the next fix prompt before editing starts.',
  ],
  projscan_pr_diff: [
    'The structural diff is reviewed for changed exports, imports, call sites, and complexity before a full review verdict.',
    'The developer knows which changed files or symbols need deeper review.',
  ],
  projscan_coverage: [
    'Coverage gaps are ranked by risk so the next test target is explicit.',
    'The selected file has either a new test plan, an owner, or a documented reason to defer.',
  ],
  projscan_upgrade: [
    'The upgrade preview identifies declared version, installed version, breaking markers, and importers.',
    'Importer files are reviewed before changing the package version.',
  ],
  projscan_audit: [
    'npm audit findings are reviewed for critical, high, moderate, low, and info vulnerabilities.',
    'Any vulnerable dependency has a fix, upgrade preview, or documented deferral before the branch is trusted.',
  ],
  projscan_workspaces: [
    'Monorepo workspace packages are listed with names and relative paths before package-scoped work begins.',
    'The selected workspace name is available for package-scoped follow-up commands such as hotspots, coupling, review, or audit.',
  ],
  projscan_dataflow: [
    'Dataflow findings are reviewed for direct, propagated, and bridge source-to-sink paths.',
    'Any confirmed source-to-sink path has an owner, mitigation, and rerunnable verification command before editing continues.',
  ],
  projscan_semantic_graph: [
    'The targeted graph query answers the importer/import/export question without dumping the full graph.',
    'Any returned files are reviewed before editing the queried file or symbol.',
  ],
  projscan_search: [
    'Search results identify the target files or symbols with enough confidence to choose the next tool.',
  ],
};
