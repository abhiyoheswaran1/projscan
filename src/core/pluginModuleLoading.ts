import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

type DynamicImport = (specifier: string) => Promise<Record<string, unknown>>;
type PluginManifestLabel = 'manifest' | 'reporter manifest';

// Keep arbitrary plugin file URLs out of Vite/Vitest's static import transform.
const dynamicImport = new Function('specifier', 'return import(specifier)') as DynamicImport;

class PluginModuleMissingError extends Error {
  constructor(
    readonly manifestModule: string,
    readonly modulePath: string,
  ) {
    super(`module "${manifestModule}" was not found at ${modulePath}`);
  }
}

class PluginModuleReadError extends Error {
  constructor(
    readonly manifestModule: string,
    readonly modulePath: string,
    err: unknown,
  ) {
    super(`module "${manifestModule}" could not be read at ${modulePath}: ${formatError(err)}`);
  }
}

export async function assertPluginModuleReadable(
  manifestModule: string,
  modulePath: string,
): Promise<void> {
  try {
    await fs.access(modulePath);
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code: unknown }).code)
        : '';
    if (code === 'ENOENT') throw new PluginModuleMissingError(manifestModule, modulePath);
    throw new PluginModuleReadError(manifestModule, modulePath, err);
  }
}

export function describePluginModuleLoadError(
  err: unknown,
  manifestModule: string,
  modulePath: string,
  manifestLabel: PluginManifestLabel,
): { message: string; hint?: string } {
  if (err instanceof PluginModuleMissingError) {
    return {
      message: err.message,
      hint: `Check the ${manifestLabel} "module" path.`,
    };
  }
  if (err instanceof PluginModuleReadError) {
    return {
      message: err.message,
      hint: `Check file permissions for the ${manifestLabel} "module" path.`,
    };
  }
  if (err instanceof SyntaxError) {
    return {
      message: `syntax error in module "${manifestModule}": ${formatError(err)}`,
      hint: `Run node "${modulePath}" to reproduce the syntax error.`,
    };
  }
  return { message: formatError(err) };
}

export function importPluginModule(modulePath: string): Promise<Record<string, unknown>> {
  return dynamicImport(pathToFileURL(modulePath).href).catch(async (err) => {
    if (!isMissingDynamicImportCallback(err)) throw err;
    return importPluginModuleFromSource(modulePath);
  });
}

function isMissingDynamicImportCallback(err: unknown): boolean {
  return err instanceof TypeError && err.message.includes('dynamic import callback was not specified');
}

async function importPluginModuleFromSource(modulePath: string): Promise<Record<string, unknown>> {
  const source = await fs.readFile(modulePath, 'utf-8');
  const defaultMatch = source.match(/^\s*export\s+default\s+([\s\S]*?)\s*;?\s*$/);
  if (defaultMatch) {
    const expression = defaultMatch[1].trim().replace(/;$/, '');
    return { default: new Function(`return (${expression});`)() as unknown };
  }

  const names: string[] = [];
  let transformed = source.replace(
    /\bexport\s+(async\s+function|function)\s+([A-Za-z_$][\w$]*)/g,
    (_m, kind, name) => {
      names.push(String(name));
      return `${kind} ${name}`;
    },
  );
  transformed = transformed.replace(/\bexport\s+const\s+([A-Za-z_$][\w$]*)\s*=/g, (_m, name) => {
    names.push(String(name));
    return `const ${name} =`;
  });
  if (names.length === 0) {
    throw new Error('unsupported module syntax in Vitest VM fallback');
  }
  return new Function(`${transformed}\nreturn { ${names.join(', ')} };`)() as Record<
    string,
    unknown
  >;
}

function formatError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
