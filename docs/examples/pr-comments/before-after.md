# PR Comment Before / After Examples

These examples are website-ready source material for explaining why projscan should run on every PR.

## Docs-Only PR

### Before projscan

```text
Looks fine. Please run tests before merging.
```

### After projscan

```text
Verdict: proceed
Trust calibration: docs-only change, no actual defect blocker.
Baseline trend: no quality regression from the last clean state.
First fix: none required.
Owner route: docs / maintainers.
Next command: projscan preflight --mode before_merge --format json
Developer feedback: was anything missing or noisy?
```

## Auth/API PR

### Before projscan

```text
This touches auth. Security should probably look.
```

### After projscan

```text
Verdict: caution
Top risk: changed API route expands request handling before ownership is declared.
First fix: add or confirm the route owner, then rerun projscan review.
Owner route: platform/security from CODEOWNERS or package metadata.
Next command: projscan review --base main --head HEAD --format json
Developer feedback: did this route the right owner?
```

## Dataflow/Security PR

### Before projscan

```text
Potential injection risk. Needs manual review.
```

### After projscan

```text
Verdict: block
Actual defect: new request source reaches a DB/write sink through a bridge helper.
First fix: validate or parameterize the source before the sink.
Owner route: API/security.
Test proof: add the route-level security regression test, then rerun projscan dataflow.
Next command: projscan dataflow --format json
Developer feedback: was the fix command specific enough?
```

## Large Release PR

### Before projscan

```text
This is too big. Blocking until someone reviews everything.
```

### After projscan

```text
Verdict: caution
Manual review: large platform release risk needs sign-off; no concrete taint/dataflow/health/plugin/supply-chain blocker was found.
First fix: inspect the top changed risky function, not the whole PR blindly.
Owner route: changed package owners from CODEOWNERS.
Next command: projscan preflight --mode before_merge --format json
Developer feedback: what was noisy or missing before approval?
```

