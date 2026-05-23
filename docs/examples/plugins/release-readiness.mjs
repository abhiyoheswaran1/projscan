export default {
  render: async ({ command, payload }) => {
    if (command === 'ci') {
      const ci = payload.ci;
      return [
        `release-readiness: ${ci.pass ? 'ready' : 'not ready'}`,
        `score: ${ci.score}/100 (${ci.grade})`,
        `issues: ${ci.totalIssues}`,
        `threshold: ${ci.threshold}`,
      ].join('\n');
    }

    const issues = Array.isArray(payload.issues) ? payload.issues : [];
    const health = payload.health;
    const errors = issues.filter((issue) => issue.severity === 'error').length;
    const warnings = issues.filter((issue) => issue.severity === 'warning').length;

    return [
      `release-readiness ${command}`,
      `score: ${health?.score ?? 'n/a'}/100 (${health?.grade ?? 'n/a'})`,
      `blocking: ${errors}`,
      `warnings: ${warnings}`,
      errors > 0 ? 'decision: hold release' : 'decision: continue release checks',
    ].join('\n');
  },
};
