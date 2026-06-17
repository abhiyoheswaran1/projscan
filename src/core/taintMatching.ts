const JAVASCRIPT_CHILD_PROCESS_SINKS = new Set(['exec', 'execSync', 'spawn', 'spawnSync']);
const DEFAULT_DATABASE_SINKS = new Set(['query', 'execute', '$queryRaw', '$executeRaw', 'raw']);
const DATABASE_RECEIVERS = new Set([
  'db',
  'database',
  'pool',
  'client',
  'connection',
  'conn',
  'prisma',
  'knex',
  'sequelize',
  'repository',
  'repo',
  'manager',
  'sql',
]);
const CALL_SHAPED_DEFAULT_SOURCES = new Set(['getInput', 'readFile', 'readFileSync', 'stdin']);
const DEFAULT_HTTP_PROPERTY_SOURCES = new Set(['body', 'query', 'params', 'headers', 'cookies']);
const DATABASE_MODULE_NAMES = new Set([
  'db',
  'database',
  'sql',
  'pool',
  'client',
  'repository',
  'repo',
]);
const KNOWN_DATABASE_PACKAGES = new Set([
  'pg',
  'postgres',
  'mysql',
  'mysql2',
  'sqlite3',
  'better-sqlite3',
  'knex',
  'sequelize',
  '@prisma/client',
]);

type TaintGraphFile = {
  imports: Array<{ source: string; specifiers: string[] }>;
  adapterId?: string;
};

export function pickSourceHit(
  callees: string[],
  references: string[],
  sources: Set<string>,
  customSources: Set<string>,
): string | null {
  for (const value of references) {
    if (customSources.has(value)) return value;
    if (sources.has(value) && !DEFAULT_HTTP_PROPERTY_SOURCES.has(value)) return value;
  }
  for (const value of callees) {
    if (customSources.has(value) || CALL_SHAPED_DEFAULT_SOURCES.has(value)) return value;
  }
  return null;
}

export function pickSinkHit(
  callees: string[],
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  sinks: Set<string>,
  customSinks: Set<string>,
  file: string,
  graphFile: TaintGraphFile,
): string | null {
  for (const callee of callees) {
    if (!sinks.has(callee)) continue;
    if (isDefaultMisidentifiedJavaScriptShellSink(callee, customSinks, file, graphFile)) continue;
    if (
      isDefaultMisidentifiedDatabaseSink(
        callee,
        directCallSites,
        memberCallSites,
        memberAliases,
        customSinks,
        file,
        graphFile,
      )
    )
      continue;
    return callee;
  }
  return null;
}

export function isDefaultChildProcessEnvPassthrough(
  sourceHit: string,
  sinkHit: string | null,
  memberReferences: string[],
  customSources: Set<string>,
  customSinks: Set<string>,
): boolean {
  if (sourceHit !== 'env') return false;
  if (!sinkHit || !JAVASCRIPT_CHILD_PROCESS_SINKS.has(sinkHit)) return false;
  if (customSources.has(sourceHit) || customSinks.has(sinkHit)) return false;
  return (
    memberReferences.includes('process.env') &&
    !memberReferences.some((reference) => reference.startsWith('process.env.'))
  );
}

function isDefaultMisidentifiedJavaScriptShellSink(
  callee: string,
  customSinks: Set<string>,
  file: string,
  graphFile: TaintGraphFile,
): boolean {
  if (customSinks.has(callee)) return false;
  if (!JAVASCRIPT_CHILD_PROCESS_SINKS.has(callee)) return false;
  if (!isJavaScriptLikeFile(file, graphFile.adapterId)) return false;
  return !graphFile.imports.some(
    (imp) =>
      (imp.source === 'node:child_process' || imp.source === 'child_process') &&
      (imp.specifiers.includes(callee) || imp.specifiers.length === 0),
  );
}

function isDefaultMisidentifiedDatabaseSink(
  callee: string,
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  customSinks: Set<string>,
  file: string,
  graphFile: TaintGraphFile,
): boolean {
  if (customSinks.has(callee)) return false;
  if (!DEFAULT_DATABASE_SINKS.has(callee)) return false;
  if (!isJavaScriptLikeFile(file, graphFile.adapterId)) return false;
  if (memberCallSites.some((member) => isDatabaseMemberCall(member, callee))) return false;
  if (directCallSites.includes(callee) && isImportedDatabaseHelper(callee, graphFile.imports))
    return false;
  if (
    directCallSites.includes(callee) &&
    memberAliases.some((alias) => isDatabaseMemberAlias(alias, callee))
  )
    return false;
  return true;
}

function isDatabaseMemberCall(member: string, callee: string): boolean {
  const parts = member.split('.');
  if (parts[parts.length - 1] !== callee) return false;
  const receiver = parts.length >= 2 ? parts[parts.length - 2].toLowerCase() : '';
  return DATABASE_RECEIVERS.has(receiver);
}

function isImportedDatabaseHelper(
  callee: string,
  imports: Array<{ source: string; specifiers: string[] }>,
): boolean {
  return imports.some((imp) => imp.specifiers.includes(callee) && isDatabaseModule(imp.source));
}

function isDatabaseModule(source: string): boolean {
  if (KNOWN_DATABASE_PACKAGES.has(source)) return true;
  const normalized = source.replace(/\\/g, '/');
  const last = normalized.split('/').pop() ?? normalized;
  const basename = last.replace(/\.(?:c|m)?(?:j|t)sx?$/i, '').toLowerCase();
  return DATABASE_MODULE_NAMES.has(basename);
}

function isDatabaseMemberAlias(alias: string, callee: string): boolean {
  const [localName, member] = alias.split('=');
  return localName === callee && isDatabaseMemberCall(member ?? '', callee);
}

function isJavaScriptLikeFile(file: string, adapterId?: string): boolean {
  return adapterId === 'javascript' || /\.(?:cjs|mjs|js|jsx|ts|tsx)$/.test(file);
}
