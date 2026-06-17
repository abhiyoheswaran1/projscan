export function printStabilityReport(report) {
  if (report.additions.length > 0) {
    console.log('Stable-surface additions (allowed on minor/patch):');
    for (const addition of report.additions) console.log(`  ${addition}`);
    console.log('');
  }

  if (report.issues.length === 0) {
    console.log(`✓ stable surface holds against ${report.baselinePath}`);
    return;
  }

  console.error('✗ stable-surface regressions detected:');
  for (const issue of report.issues) console.error(`  ${issue}`);
  console.error('');
  console.error(
    'These changes require a major version bump. If that is intentional, run:\n' +
      '  node scripts/check-stability.mjs --update\n' +
      'to refresh the baseline. Otherwise, restore the removed/renamed surface.',
  );
}
