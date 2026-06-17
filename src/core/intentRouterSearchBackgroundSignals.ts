export function searchBackgroundWorkContextMatches(tokens: Set<string>): boolean {
  if (
    [
      'add',
      'create',
      'implement',
      'build',
      'put',
      'new',
      'change',
      'plan',
      'should',
      'todo',
      'next',
      'do',
    ].some((token) => tokens.has(token))
  ) {
    return false;
  }
  const explicitSubject = [
    'background',
    'cron',
    'scheduled',
    'schedule',
    'scheduler',
    'schedulers',
    'worker',
    'workers',
    'queue',
    'queues',
    'processor',
    'processors',
  ].some((token) => tokens.has(token));
  const jobSubject =
    (tokens.has('job') || tokens.has('jobs')) &&
    ['background', 'cron', 'scheduled', 'schedule'].some((token) => tokens.has(token));
  const taskSubject =
    (tokens.has('task') || tokens.has('tasks')) &&
    ['scheduled', 'schedule'].some((token) => tokens.has(token));
  if (!explicitSubject && !jobSubject && !taskSubject) return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'exist',
      'exists',
      'defined',
      'handles',
      'handled',
      'process',
      'processes',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}
