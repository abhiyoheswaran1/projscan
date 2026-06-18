import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control intent target helper architecture', () => {
  it('keeps shell argument helpers in a focused helper', () => {
    const targetSource = readTargetSource();
    const shellArgsPath = path.join(process.cwd(), 'src/core/startShellArgs.ts');

    expect(targetSource).toContain(
      "export { escapeDoubleQuoted, isPlaceholder, quoteShellArg, quoteShellArgOrPlaceholder } from './startShellArgs.js';",
    );
    expect(targetSource).not.toContain("import { isPlaceholder, quoteShellArg }");
    expect(targetSource).not.toContain('function escapeDoubleQuoted');
    expect(targetSource).not.toContain('function quoteShellArgOrPlaceholder');

    expect(existsSync(shellArgsPath)).toBe(true);
    const shellArgsSource = readFileSync(shellArgsPath, 'utf8');
    expect(shellArgsSource).toContain('export function quoteShellArg');
    expect(shellArgsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps generic target text helpers in a focused helper', () => {
    const targetSource = readTargetSource();
    const targetTextPath = path.join(process.cwd(), 'src/core/startIntentTargetText.ts');

    expect(targetSource).toContain("import { unwrapTarget } from './startIntentTargetText.js';");
    expect(targetSource).not.toContain('isGenericReferenceTarget');
    expect(targetSource).not.toContain('function unwrapTarget');
    expect(targetSource).not.toContain('function isGenericReferenceTarget');

    expect(existsSync(targetTextPath)).toBe(true);
    const targetTextSource = readFileSync(targetTextPath, 'utf8');
    expect(targetTextSource).toContain('export function unwrapTarget');
    expect(targetTextSource).toContain('export function isGenericReferenceTarget');
    expect(targetTextSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps package target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const packageTargetsPath = path.join(process.cwd(), 'src/core/startPackageTargets.ts');

    expect(targetSource).toContain("from './startPackageTargets.js';");
    expect(targetSource).toContain(
      "export { extractAuditPackageTarget, extractPackageTarget } from './startPackageTargets.js';",
    );
    expect(targetSource).not.toContain('function extractPackageTarget');
    expect(targetSource).not.toContain('function extractAuditPackageTarget');
    expect(targetSource).not.toContain('function isPackageNameTarget');

    expect(existsSync(packageTargetsPath)).toBe(true);
    const packageTargetsSource = readFileSync(packageTargetsPath, 'utf8');
    expect(packageTargetsSource).toContain('export function extractPackageTarget');
    expect(packageTargetsSource).toContain('export function extractAuditPackageTarget');
    expect(packageTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps issue id target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const issueTargetsPath = path.join(process.cwd(), 'src/core/startIssueTargets.ts');

    expect(targetSource).toContain("export { extractIssueIdTarget } from './startIssueTargets.js';");
    expect(targetSource).not.toContain('function extractIssueIdTarget');
    expect(targetSource).not.toContain('function isIssueIdTarget');

    expect(existsSync(issueTargetsPath)).toBe(true);
    const issueTargetsSource = readFileSync(issueTargetsPath, 'utf8');
    expect(issueTargetsSource).toContain('export function extractIssueIdTarget');
    expect(issueTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps symbol target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const symbolTargetsPath = path.join(process.cwd(), 'src/core/startSymbolTargets.ts');

    expect(targetSource).toContain("export { isExactSymbolTarget } from './startSymbolTargets.js';");
    expect(targetSource).not.toContain("import { extractSymbolTarget }");
    expect(targetSource).not.toContain('function extractSymbolTarget');
    expect(targetSource).not.toContain('function isSymbolNameTarget');
    expect(targetSource).not.toContain('function isExactSymbolTarget');

    expect(existsSync(symbolTargetsPath)).toBe(true);
    const symbolTargetsSource = readFileSync(symbolTargetsPath, 'utf8');
    expect(symbolTargetsSource).toContain('export function extractSymbolTarget');
    expect(symbolTargetsSource).toContain('export function isExactSymbolTarget');
    expect(symbolTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps file target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const fileTargetsPath = path.join(process.cwd(), 'src/core/startFileTargets.ts');

    expect(targetSource).toContain("import { extractFileTarget } from './startFileTargets.js';");
    expect(targetSource).toContain(
      "export { extractFileTarget, isFilePathTarget } from './startFileTargets.js';",
    );
    expect(targetSource).not.toContain('function extractFileTarget');
    expect(targetSource).not.toContain('function isFilePathTarget');

    expect(existsSync(fileTargetsPath)).toBe(true);
    const fileTargetsSource = readFileSync(fileTargetsPath, 'utf8');
    expect(fileTargetsSource).toContain('export function extractFileTarget');
    expect(fileTargetsSource).toContain('export function isFilePathTarget');
    expect(fileTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps env target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const envTargetsPath = path.join(process.cwd(), 'src/core/startEnvTargets.ts');

    expect(targetSource).toContain("import { extractEnvVarTarget } from './startEnvTargets.js';");
    expect(targetSource).not.toContain('function extractEnvVarTarget');

    expect(existsSync(envTargetsPath)).toBe(true);
    const envTargetsSource = readFileSync(envTargetsPath, 'utf8');
    expect(envTargetsSource).toContain('export function extractEnvVarTarget');
    expect(envTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps impact target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const impactTargetsPath = path.join(process.cwd(), 'src/core/startImpactTargets.ts');

    expect(targetSource).toContain(
      "export { extractImpactTarget } from './startImpactTargets.js';",
    );
    expect(targetSource).not.toContain('function extractImpactTarget');

    expect(existsSync(impactTargetsPath)).toBe(true);
    const impactTargetsSource = readFileSync(impactTargetsPath, 'utf8');
    expect(impactTargetsSource).toContain('export function extractImpactTarget');
    expect(impactTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps claim target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const claimTargetsPath = path.join(process.cwd(), 'src/core/startClaimTargets.ts');

    expect(targetSource).toContain("from './startClaimTargets.js';");
    expect(targetSource).toContain(
      "export { extractClaimAgent, extractClaimTarget } from './startClaimTargets.js';",
    );
    expect(targetSource).not.toContain('function extractClaimTarget');
    expect(targetSource).not.toContain('function extractClaimAgent');

    expect(existsSync(claimTargetsPath)).toBe(true);
    const claimTargetsSource = readFileSync(claimTargetsPath, 'utf8');
    expect(claimTargetsSource).toContain('export function extractClaimTarget');
    expect(claimTargetsSource).toContain('export function extractClaimAgent');
    expect(claimTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps quoted text target parsing in a focused helper', () => {
    const targetSource = readTargetSource();
    const quotedTargetsPath = path.join(process.cwd(), 'src/core/startQuotedTextTargets.ts');

    expect(targetSource).toContain(
      "import { extractQuotedTextTarget } from './startQuotedTextTargets.js';",
    );
    expect(targetSource).not.toContain('function extractQuotedTextTarget');

    expect(existsSync(quotedTargetsPath)).toBe(true);
    const quotedTargetsSource = readFileSync(quotedTargetsPath, 'utf8');
    expect(quotedTargetsSource).toContain('export function extractQuotedTextTarget');
    expect(quotedTargetsSource).not.toContain("from './startIntentTargets.js'");
  });

  it('keeps graph target parsing and commands in a focused helper', () => {
    const targetSource = readTargetSource();
    const graphTargetsPath = path.join(process.cwd(), 'src/core/startGraphTargets.ts');

    expect(targetSource).toContain("export type { StartGraphQuery } from './startGraphTargets.js';");
    expect(targetSource).toContain(
      "export { graphQueryFromIntent, graphQueryIsReady, semanticGraphCommand } from './startGraphTargets.js';",
    );
    expect(targetSource).not.toContain('function graphQueryFromIntent');
    expect(targetSource).not.toContain('function graphQueryForDirection');
    expect(targetSource).not.toContain('GRAPH_DIRECTION_RULES');
    expect(targetSource).not.toContain('function semanticGraphCommand');

    expect(existsSync(graphTargetsPath)).toBe(true);
    const graphTargetsSource = readFileSync(graphTargetsPath, 'utf8');
    expect(graphTargetsSource).toContain('export function graphQueryFromIntent');
    expect(graphTargetsSource).toContain('export function graphQueryIsReady');
    expect(graphTargetsSource).toContain('export function semanticGraphCommand');
    expect(graphTargetsSource).not.toContain("from './startIntentTargets.js'");
  });
});

function readTargetSource(): string {
  return readFileSync(path.join(process.cwd(), 'src/core/startIntentTargets.ts'), 'utf8');
}
