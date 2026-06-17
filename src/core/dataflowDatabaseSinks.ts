export interface DataflowDatabaseSinkGraphFile {
  imports: Array<{ source: string; specifiers: string[] }>;
  adapterId?: string;
}

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

export function isDefaultMisidentifiedDatabaseSink(
  callee: string,
  directCallSites: string[],
  memberCallSites: string[],
  memberAliases: string[],
  customSinks: Set<string>,
  file: string,
  graphFile: DataflowDatabaseSinkGraphFile,
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
