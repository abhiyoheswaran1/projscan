export function detectFileIssues(content: string, lineCount: number): string[] {
  const issues: string[] = [];

  if (lineCount > 500) issues.push(`Large file (${lineCount} lines) - consider splitting`);
  if (lineCount > 1000) issues.push('Very large file - strongly consider refactoring');

  if (/console\.(log|warn|error|debug)\s*\(/.test(content)) {
    issues.push('Contains console.log statements - consider using a proper logger');
  }

  if (/TODO|FIXME|HACK|XXX/i.test(content)) {
    issues.push('Contains TODO/FIXME comments');
  }

  if (/:\s*any\b/.test(content) && /\.tsx?$/.test(content)) {
    issues.push('Uses "any" type - consider using proper types');
  }

  return issues;
}
