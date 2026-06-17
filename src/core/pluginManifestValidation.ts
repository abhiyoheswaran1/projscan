import path from 'node:path';

export const PLUGIN_SCHEMA_VERSION = 1;

export type PluginKind = 'analyzer' | 'reporter';
export type PluginReporterCommand = 'doctor' | 'analyze' | 'ci';

export const PLUGIN_REPORTER_COMMANDS = ['doctor', 'analyze', 'ci'] as const;

interface PluginManifestBase {
  schemaVersion: number;
  name: string;
  kind: PluginKind;
  /** Module entry point, relative to the manifest file. */
  module: string;
  /** Optional human-readable summary. */
  description?: string;
}

export interface PluginAnalyzerManifest extends PluginManifestBase {
  kind: 'analyzer';
  /** Issue category emitted by this plugin (`Issue.category`). */
  category: string;
}

export interface PluginReporterManifest extends PluginManifestBase {
  kind: 'reporter';
  /** CLI commands this reporter can render. */
  commands: PluginReporterCommand[];
}

export type PluginManifest = PluginAnalyzerManifest | PluginReporterManifest;

export interface PluginDiagnostic {
  code:
    | 'invalid-manifest'
    | 'unsupported-schema-version'
    | 'invalid-name'
    | 'unsupported-kind'
    | 'invalid-module'
    | 'invalid-category'
    | 'invalid-commands'
    | 'invalid-description'
    | 'invalid-manifest-path'
    | 'invalid-json'
    | 'read-error'
    | 'plugins-disabled'
    | 'reporter-not-found'
    | 'reporter-unsupported-command'
    | 'invalid-reporter-export'
    | 'reporter-load-error'
    | 'reporter-render-error'
    | 'plugin-untrusted';
  message: string;
  field?: string;
  hint?: string;
}

interface ValidationOk {
  ok: true;
  manifest: PluginManifest;
}

interface ValidationFail {
  ok: false;
  reason: string;
  diagnostic: PluginDiagnostic;
}

interface ValidPluginManifestBase {
  schemaVersion: typeof PLUGIN_SCHEMA_VERSION;
  name: string;
  kind: PluginKind;
  module: string;
  description?: string;
}

type ManifestObjectValidation = { ok: true; obj: Record<string, unknown> } | ValidationFail;
type ManifestBaseValidation =
  | { ok: true; obj: Record<string, unknown>; base: ValidPluginManifestBase }
  | ValidationFail;
type ManifestDiagnosticCheck = (obj: Record<string, unknown>) => PluginDiagnostic | null;

const BASE_MANIFEST_DIAGNOSTICS: ManifestDiagnosticCheck[] = [
  schemaVersionDiagnostic,
  nameDiagnostic,
  kindDiagnostic,
  moduleDiagnostic,
  descriptionDiagnostic,
];

export function validateManifest(input: unknown): ValidationOk | ValidationFail {
  const validation = validateManifestBase(input);
  if (!validation.ok) return validation;
  return validation.base.kind === 'analyzer'
    ? validateAnalyzerManifest(validation.obj, validation.base)
    : validateReporterManifest(validation.obj, validation.base);
}

function validateManifestBase(input: unknown): ManifestBaseValidation {
  const objectValidation = validateManifestObject(input);
  if (!objectValidation.ok) return objectValidation;
  const diagnostic = BASE_MANIFEST_DIAGNOSTICS.map((check) => check(objectValidation.obj)).find(
    (item): item is PluginDiagnostic => item !== null,
  );
  if (diagnostic) return failValidation(diagnostic);
  return {
    ok: true,
    obj: objectValidation.obj,
    base: manifestBaseFromObject(objectValidation.obj),
  };
}

function validateManifestObject(input: unknown): ManifestObjectValidation {
  if (input && typeof input === 'object') return { ok: true, obj: input as Record<string, unknown> };
  return failValidation({
    code: 'invalid-manifest',
    message: 'manifest must be a JSON object',
    hint: 'Use an object with schemaVersion, name, kind, module, and category fields.',
  });
}

function manifestBaseFromObject(obj: Record<string, unknown>): ValidPluginManifestBase {
  return {
    schemaVersion: PLUGIN_SCHEMA_VERSION,
    name: obj.name as string,
    kind: obj.kind as PluginKind,
    module: obj.module as string,
    ...(typeof obj.description === 'string' ? { description: obj.description } : {}),
  };
}

function schemaVersionDiagnostic(obj: Record<string, unknown>): PluginDiagnostic | null {
  if (obj.schemaVersion === PLUGIN_SCHEMA_VERSION) return null;
  return {
    code: 'unsupported-schema-version',
    field: 'schemaVersion',
    message: `unsupported schemaVersion ${String(obj.schemaVersion)}; expected ${PLUGIN_SCHEMA_VERSION}`,
    hint: `Set "schemaVersion": ${PLUGIN_SCHEMA_VERSION}.`,
  };
}

function nameDiagnostic(obj: Record<string, unknown>): PluginDiagnostic | null {
  if (typeof obj.name === 'string' && /^[a-z0-9][a-z0-9._/-]{0,64}$/i.test(obj.name)) return null;
  return {
    code: 'invalid-name',
    field: 'name',
    message: 'name is required and must be 1-65 chars of [a-z0-9._/-]',
    hint: 'Use a stable 1-65 character plugin id such as "team/no-console" or "my-plugin".',
  };
}

function kindDiagnostic(obj: Record<string, unknown>): PluginDiagnostic | null {
  if (obj.kind === 'analyzer' || obj.kind === 'reporter') return null;
  return {
    code: 'unsupported-kind',
    field: 'kind',
    message: 'kind must be "analyzer" or "reporter"',
    hint: 'Set "kind": "analyzer" for issue-producing plugins or "kind": "reporter" for CLI output plugins.',
  };
}

function moduleDiagnostic(obj: Record<string, unknown>): PluginDiagnostic | null {
  if (typeof obj.module !== 'string' || obj.module.length === 0) {
    return {
      code: 'invalid-module',
      field: 'module',
      message: 'module is required and must be a relative path',
      hint: 'Point to a local module inside the same plugin directory, for example "./check.mjs".',
    };
  }
  if (path.isAbsolute(obj.module) || obj.module.split(/[/\\]/).some((seg) => seg === '..')) {
    return {
      code: 'invalid-module',
      field: 'module',
      message: 'module must be a relative path inside the plugin dir',
      hint: 'Do not use absolute paths or any ".." path segment.',
    };
  }
  return null;
}

function descriptionDiagnostic(obj: Record<string, unknown>): PluginDiagnostic | null {
  if (obj.description === undefined || typeof obj.description === 'string') return null;
  return {
    code: 'invalid-description',
    field: 'description',
    message: 'description must be a string when provided',
  };
}

function validateAnalyzerManifest(
  obj: Record<string, unknown>,
  base: ValidPluginManifestBase,
): ValidationOk | ValidationFail {
  if (typeof obj.category !== 'string' || obj.category.length === 0) {
    return failValidation({
      code: 'invalid-category',
      field: 'category',
      message: 'category is required for analyzer plugins',
      hint: 'Use the fallback Issue.category for this plugin, for example "custom" or "security".',
    });
  }
  return {
    ok: true,
    manifest: {
      schemaVersion: base.schemaVersion,
      name: base.name,
      kind: 'analyzer',
      module: base.module,
      category: obj.category,
      ...(base.description ? { description: base.description } : {}),
    },
  };
}

function validateReporterManifest(
  obj: Record<string, unknown>,
  base: ValidPluginManifestBase,
): ValidationOk | ValidationFail {
  const commandValidation = validateReporterCommands(obj.commands);
  if (!commandValidation.ok) return commandValidation;

  return {
    ok: true,
    manifest: {
      schemaVersion: base.schemaVersion,
      name: base.name,
      kind: 'reporter',
      module: base.module,
      commands: commandValidation.commands,
      ...(base.description ? { description: base.description } : {}),
    },
  };
}

function validateReporterCommands(
  input: unknown,
): { ok: true; commands: PluginReporterCommand[] } | ValidationFail {
  if (!Array.isArray(input) || input.length === 0) {
    return failValidation({
      code: 'invalid-commands',
      field: 'commands',
      message: 'commands must be a non-empty array for reporter plugins',
      hint: 'Use one or more supported commands: doctor, analyze, ci.',
    });
  }

  const seen = new Set<PluginReporterCommand>();
  const invalid: string[] = [];
  for (const value of input) {
    if (typeof value !== 'string' || !isReporterCommand(value)) {
      invalid.push(String(value));
      continue;
    }
    seen.add(value);
  }
  if (invalid.length > 0) {
    return failValidation({
      code: 'invalid-commands',
      field: 'commands',
      message: `unsupported reporter command(s): ${invalid.join(', ')}`,
      hint: 'Supported reporter commands are: doctor, analyze, ci.',
    });
  }
  return { ok: true, commands: [...seen] };
}

function isReporterCommand(value: string): value is PluginReporterCommand {
  return (PLUGIN_REPORTER_COMMANDS as readonly string[]).includes(value);
}

function failValidation(diagnostic: PluginDiagnostic): ValidationFail {
  return { ok: false, reason: diagnostic.message, diagnostic };
}
