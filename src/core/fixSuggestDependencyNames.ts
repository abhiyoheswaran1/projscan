export function parseDepName(issueId: string): string {
  // unused-dependency-foo or unused-dependency-packages/a-foo
  // The workspace-aware id has the form `unused-dependency-<workspace>-<name>`
  // but we can't disambiguate without parsing locations; the simple suffix
  // is right in the common case (single-package).
  const tail = issueId.replace(/^unused-dependency-/, '');
  return tail || '<unknown>';
}
