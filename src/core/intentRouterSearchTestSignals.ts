import {
  databaseSetupCommandContextMatches,
  packageScriptDiscoveryContextMatches,
} from './intentRouterRepoSignals.js';

export function searchTestDataContextMatches(tokens: Set<string>): boolean {
  if (packageScriptDiscoveryContextMatches(tokens)) return false;
  if (databaseSetupCommandContextMatches(tokens)) return false;
  if (
    ['add', 'write', 'create', 'generate', 'plan', 'should', 'next', 'todo'].some((token) =>
      tokens.has(token),
    )
  )
    return false;
  const seedSubject =
    tokens.has('seed') ||
    tokens.has('seeds') ||
    ((tokens.has('data') || tokens.has('database')) && (tokens.has('seed') || tokens.has('seeds')));
  const fixtureSubject = tokens.has('fixture') || tokens.has('fixtures');
  const mockSubject = tokens.has('mock') || tokens.has('mocks');
  const factorySubject = tokens.has('factory') || tokens.has('factories');
  const storySubject = tokens.has('storybook') || tokens.has('story') || tokens.has('stories');
  if (!seedSubject && !fixtureSubject && !mockSubject && !factorySubject && !storySubject)
    return false;
  return (
    [
      'where',
      'which',
      'what',
      'find',
      'locate',
      'search',
      'lookup',
      'used',
      'defined',
      'configured',
      'for',
      'render',
      'renders',
    ].some((token) => tokens.has(token)) || tokens.size >= 3
  );
}
