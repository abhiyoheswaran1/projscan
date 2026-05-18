export default {
  render: async ({ command, payload }) => {
    if (command === 'ci') {
      const ci = payload.ci;
      return `team-radar ci ${ci.pass ? 'pass' : 'fail'} ${ci.score}/100 ${ci.grade} ${ci.totalIssues} issue(s)`;
    }

    if (command === 'doctor') {
      const health = payload.health;
      const issues = Array.isArray(payload.issues) ? payload.issues.length : 0;
      return `team-radar doctor ${health.score}/100 ${health.grade} ${issues} issue(s)`;
    }

    const issues = Array.isArray(payload.issues) ? payload.issues.length : 0;
    return `team-radar analyze ${issues} issue(s)`;
  },
};
