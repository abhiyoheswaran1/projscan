import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildApplyPlanForIssue } from '../../src/core/fixSuggest.js';
import type { Issue } from '../../src/types.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-apply-plans-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function issue(id: string, locations?: Issue['locations']): Issue {
  return {
    id,
    title: id,
    description: '',
    severity: 'warning',
    category: 'test',
    fixAvailable: true,
    locations,
  };
}

describe('buildApplyPlanForIssue (1.6+)', () => {
  describe('unused-dependency-*', () => {
    it('removes the named dep from dependencies and emits a modify change', async () => {
      const pkg = {
        name: 't',
        dependencies: { lodash: '^4.0.0', chalk: '^5.0.0' },
      };
      await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));

      const plan = await buildApplyPlanForIssue(issue('unused-dependency-lodash'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes).toHaveLength(1);
      const change = plan!.changes[0];
      expect(change.op).toBe('modify');
      expect(change.path).toBe('package.json');
      const updated = JSON.parse(change.content!);
      expect(updated.dependencies).not.toHaveProperty('lodash');
      expect(updated.dependencies).toHaveProperty('chalk', '^5.0.0');
      // Roundtrips to a stable, indented form (pretty for diff readability).
      expect(change.content).toContain('\n  "name": "t"');
    });

    it('removes the dep from devDependencies if that is where it lives', async () => {
      const pkg = {
        name: 't',
        dependencies: {},
        devDependencies: { vitest: '^2.0.0', eslint: '^9.0.0' },
      };
      await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify(pkg, null, 2));
      const plan = await buildApplyPlanForIssue(issue('unused-dependency-vitest'), tmp);
      expect(plan).not.toBeNull();
      const updated = JSON.parse(plan!.changes[0].content!);
      expect(updated.devDependencies).not.toHaveProperty('vitest');
      expect(updated.devDependencies).toHaveProperty('eslint');
    });

    it('returns null when the dep is not present in the manifest (idempotent)', async () => {
      await fs.writeFile(
        path.join(tmp, 'package.json'),
        JSON.stringify({ name: 't', dependencies: {} }),
      );
      const plan = await buildApplyPlanForIssue(issue('unused-dependency-lodash'), tmp);
      expect(plan).toBeNull();
    });

    it('returns null when the manifest is missing or unparseable', async () => {
      // No package.json at all.
      let plan = await buildApplyPlanForIssue(issue('unused-dependency-lodash'), tmp);
      expect(plan).toBeNull();

      // Manifest exists but is invalid JSON.
      await fs.writeFile(path.join(tmp, 'package.json'), 'this is not json');
      plan = await buildApplyPlanForIssue(issue('unused-dependency-lodash'), tmp);
      expect(plan).toBeNull();
    });

    it('uses the issue location to pick a workspace package.json over the root', async () => {
      // Root manifest with the dep.
      await fs.writeFile(
        path.join(tmp, 'package.json'),
        JSON.stringify({ name: 'root', dependencies: { lodash: '^4.0.0' } }),
      );
      // Workspace package with its own copy of the dep.
      await fs.mkdir(path.join(tmp, 'packages', 'a'), { recursive: true });
      await fs.writeFile(
        path.join(tmp, 'packages', 'a', 'package.json'),
        JSON.stringify({ name: 'a', dependencies: { lodash: '^3.0.0', other: '^1' } }),
      );
      const plan = await buildApplyPlanForIssue(
        issue('unused-dependency-lodash', [{ file: 'packages/a/package.json' }]),
        tmp,
      );
      expect(plan).not.toBeNull();
      expect(plan!.changes[0].path).toBe('packages/a/package.json');
      const updated = JSON.parse(plan!.changes[0].content!);
      expect(updated.dependencies).not.toHaveProperty('lodash');
      expect(updated.dependencies).toHaveProperty('other');
    });
  });

  describe('missing-test-framework', () => {
    it('scaffolds vitest config + smoke test when package.json exists', async () => {
      await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
      const plan = await buildApplyPlanForIssue(issue('missing-test-framework'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes).toHaveLength(2);
      const paths = plan!.changes.map((c) => c.path);
      expect(paths).toContain('vitest.config.ts');
      expect(paths).toContain('src/__smoke__.test.ts');
      for (const c of plan!.changes) {
        expect(c.op).toBe('create');
        expect(c.content).toBeTruthy();
      }
    });

    it('returns null when no package.json exists (JS-only template)', async () => {
      const plan = await buildApplyPlanForIssue(issue('missing-test-framework'), tmp);
      expect(plan).toBeNull();
    });

    it('returns null for the python variant (deferred to project-specific config)', async () => {
      await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
      const plan = await buildApplyPlanForIssue(issue('missing-python-test-framework'), tmp);
      expect(plan).toBeNull();
    });
  });

  describe('missing-eslint', () => {
    it('scaffolds eslint.config.js with flat config', async () => {
      const plan = await buildApplyPlanForIssue(issue('missing-eslint'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes).toHaveLength(1);
      expect(plan!.changes[0]).toMatchObject({ path: 'eslint.config.js', op: 'create' });
      expect(plan!.changes[0].content).toContain("import js from '@eslint/js';");
      expect(plan!.changes[0].content).toContain('export default');
    });
  });

  describe('missing-prettier', () => {
    it('scaffolds .prettierrc with sensible defaults', async () => {
      const plan = await buildApplyPlanForIssue(issue('missing-prettier'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes).toHaveLength(1);
      expect(plan!.changes[0]).toMatchObject({ path: '.prettierrc', op: 'create' });
      const parsed = JSON.parse(plan!.changes[0].content!);
      expect(parsed).toMatchObject({
        semi: true,
        singleQuote: true,
        trailingComma: 'all',
      });
    });
  });

  describe('missing-editorconfig', () => {
    it('scaffolds .editorconfig with the conventional defaults', async () => {
      const plan = await buildApplyPlanForIssue(issue('missing-editorconfig'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes).toHaveLength(1);
      expect(plan!.changes[0]).toMatchObject({ path: '.editorconfig', op: 'create' });
      const content = plan!.changes[0].content!;
      expect(content).toMatch(/^root = true/);
      expect(content).toContain('indent_style = space');
      expect(content).toContain('end_of_line = lf');
      expect(content).toContain('charset = utf-8');
      expect(content).toContain('insert_final_newline = true');
    });
  });

  describe('missing-readme', () => {
    it('uses package.json#name as the heading when package.json is present', async () => {
      await fs.writeFile(
        path.join(tmp, 'package.json'),
        JSON.stringify({ name: 'cool-project' }),
      );
      const plan = await buildApplyPlanForIssue(issue('missing-readme'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes[0]).toMatchObject({ path: 'README.md', op: 'create' });
      expect(plan!.changes[0].content).toContain('# cool-project');
      expect(plan!.changes[0].content).toContain('## Install');
      expect(plan!.changes[0].content).toContain('## Usage');
    });

    it('falls back to the directory basename when package.json is missing', async () => {
      const plan = await buildApplyPlanForIssue(issue('missing-readme'), tmp);
      expect(plan).not.toBeNull();
      // tmp dir basename starts with 'projscan-apply-plans-'
      const heading = plan!.changes[0].content!.split('\n')[0];
      expect(heading).toMatch(/^# projscan-apply-plans-/);
    });

    it('falls back to the directory basename when package.json is unparseable', async () => {
      await fs.writeFile(path.join(tmp, 'package.json'), 'not json');
      const plan = await buildApplyPlanForIssue(issue('missing-readme'), tmp);
      expect(plan).not.toBeNull();
      expect(plan!.changes[0].content!.split('\n')[0]).toMatch(/^# projscan-apply-plans-/);
    });
  });

  describe('dispatcher', () => {
    it('returns null for an issue id that no template matches', async () => {
      const plan = await buildApplyPlanForIssue(issue('totally-fictional-rule-id'), tmp);
      expect(plan).toBeNull();
    });

    it('returns null when a template matches but does not declare apply support', async () => {
      // 'cycle-detected-X' matches a template that has no buildApplyPlan.
      const plan = await buildApplyPlanForIssue(issue('cycle-detected-1'), tmp);
      expect(plan).toBeNull();
    });
  });
});
