export function styleSystemFailureContextMatches(tokens: Set<string>): boolean {
  const styleSubject =
    (tokens.has('dark') && tokens.has('mode')) ||
    (tokens.has('design') && (tokens.has('token') || tokens.has('tokens'))) ||
    tokens.has('tailwind') ||
    tokens.has('css') ||
    tokens.has('breakpoint') ||
    tokens.has('breakpoints');
  return styleSubject && regressionFailureContextMatches(tokens);
}

export function toolingFailureContextMatches(tokens: Set<string>): boolean {
  const toolingSubject = [
    'vite',
    'vitest',
    'jest',
    'babel',
    'webpack',
    'tsconfig',
    'typescript',
    'pnpm',
    'yarn',
    'npm',
  ].some((token) => tokens.has(token));
  return toolingSubject && regressionFailureContextMatches(tokens);
}

export function regressionFailureContextMatches(tokens: Set<string>): boolean {
  const failureSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
  ].some((token) => tokens.has(token));
  const statusCodeSignal = ['500', '502', '503', '504', '404', '403', '401'].some((token) =>
    tokens.has(token),
  );
  const downOutageSignal =
    tokens.has('down') &&
    ['production', 'prod', 'service', 'site', 'app', 'api', 'outage'].some((token) =>
      tokens.has(token),
    );
  const outageSignal =
    downOutageSignal ||
    ['production', 'prod', 'outage', 'incident', 'runtime', 'crash', 'crashes', 'crashing'].some(
      (token) => tokens.has(token),
    );
  const connectionRefusedSignal = tokens.has('connection') && tokens.has('refused');
  const localSetupSignal = regressionLocalSetupContextMatches(tokens);
  const triageSignal = tokens.has('triage') && outageSignal;
  const stackTraceSignal = tokens.has('stack') && tokens.has('trace');
  const debugSignal =
    tokens.has('debug') &&
    (tokens.has('stack') || tokens.has('trace') || tokens.has('error') || tokens.has('errors'));
  const rootCauseSignal =
    tokens.has('root') &&
    tokens.has('cause') &&
    (failureSignal || statusCodeSignal || outageSignal);
  const returningStatusSignal =
    (tokens.has('returning') || tokens.has('returns')) && statusCodeSignal;
  const logFailureSignal =
    (tokens.has('log') || tokens.has('logs')) &&
    (failureSignal || outageSignal || statusCodeSignal);
  return (
    failureSignal ||
    statusCodeSignal ||
    outageSignal ||
    connectionRefusedSignal ||
    localSetupSignal ||
    triageSignal ||
    stackTraceSignal ||
    debugSignal ||
    rootCauseSignal ||
    returningStatusSignal ||
    logFailureSignal
  );
}

export function regressionLocalSetupContextMatches(tokens: Set<string>): boolean {
  const portSignal =
    tokens.has('eaddrinuse') ||
    ((tokens.has('port') || tokens.has('ports')) &&
      ['already', 'use', 'used', 'listen', 'address', 'startup', 'start', 'server', 'dev'].some(
        (token) => tokens.has(token),
      ));
  const permissionSignal = tokens.has('permission') && tokens.has('denied');
  const packageManagerSignal =
    tokens.has('enoent') ||
    tokens.has('eresolve') ||
    (tokens.has('peer') &&
      ['dependency', 'dependencies', 'conflict', 'install', 'npm', 'pnpm', 'yarn'].some((token) =>
        tokens.has(token),
      ));
  return portSignal || permissionSignal || packageManagerSignal;
}

export function regressionCiPlatformContextMatches(tokens: Set<string>): boolean {
  const platformSignal =
    tokens.has('ci') ||
    tokens.has('github') ||
    ['action', 'actions', 'workflow', 'workflows', 'pipeline', 'pipelines'].some((token) =>
      tokens.has(token),
    );
  const explicitTroubleSignal = [
    'fail',
    'failing',
    'failed',
    'failure',
    'failures',
    'error',
    'errors',
    'slow',
    'slower',
    'flake',
    'flaky',
    'flakes',
    'intermittent',
    'intermittently',
  ].some((token) => tokens.has(token));
  return (
    platformSignal &&
    (explicitTroubleSignal ||
      regressionFailureContextMatches(tokens) ||
      regressionPerformanceContextMatches(tokens) ||
      regressionFlakeContextMatches(tokens))
  );
}

export function regressionPerformanceContextMatches(tokens: Set<string>): boolean {
  if (
    (tokens.has('find') || tokens.has('locate') || tokens.has('search')) &&
    (tokens.has('test') || tokens.has('tests')) &&
    (tokens.has('slow') || tokens.has('slower'))
  ) {
    return false;
  }
  const performanceSignal = [
    'slow',
    'slower',
    'speed',
    'speedup',
    'faster',
    'benchmark',
    'benchmarks',
  ].some((token) => tokens.has(token));
  if (!performanceSignal) return false;
  return (
    regressionBenchmarkContextMatches(tokens) ||
    [
      'ci',
      'github',
      'action',
      'actions',
      'workflow',
      'workflows',
      'pipeline',
      'pipelines',
      'test',
      'tests',
      'build',
      'builds',
    ].some((token) => tokens.has(token))
  );
}

export function regressionBenchmarkContextMatches(tokens: Set<string>): boolean {
  return ['benchmark', 'benchmarks'].some((token) => tokens.has(token));
}

export function regressionFlakeContextMatches(tokens: Set<string>): boolean {
  const flakeSignal = [
    'flake',
    'flaky',
    'flakes',
    'intermittent',
    'intermittently',
    'nondeterministic',
    'nondeterminism',
  ].some((token) => tokens.has(token));
  const verificationSubject = [
    'ci',
    'github',
    'action',
    'actions',
    'workflow',
    'workflows',
    'pipeline',
    'pipelines',
    'test',
    'tests',
    'suite',
    'failure',
    'failures',
    'fail',
    'failing',
    'failed',
  ].some((token) => tokens.has(token));
  const reproduceSignal = ['command', 'commands', 'reproduce', 'reproduces', 'reproducing'].some(
    (token) => tokens.has(token),
  );
  const stabilizationSignal = ['stabilize', 'stabilise', 'quarantine'].some((token) =>
    tokens.has(token),
  );
  const raceSignal = tokens.has('race') && (tokens.has('condition') || verificationSubject);

  if (flakeSignal)
    return verificationSubject || reproduceSignal || stabilizationSignal || raceSignal;
  if (raceSignal) return true;
  return (reproduceSignal || stabilizationSignal) && verificationSubject;
}

export function proofCommandContextMatches(tokens: Set<string>): boolean {
  return [
    'proof',
    'prove',
    'verify',
    'verification',
    'regression',
    'test',
    'tests',
    'push',
    'pushing',
  ].some((token) => tokens.has(token));
}

export function harnessProofContextMatches(tokens: Set<string>): boolean {
  const harnessSubject = ['agentflight', 'agentloop', 'agentloopkit', 'harness'].some((token) =>
    tokens.has(token),
  );
  if (!harnessSubject) return false;
  return [
    'proof',
    'prove',
    'verify',
    'verification',
    'check',
    'checks',
    'evidence',
    'run',
    'rerun',
    'status',
    'handoff',
    'use',
    'using',
  ].some((token) => tokens.has(token));
}
