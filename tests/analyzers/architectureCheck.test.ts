import { describe, it, expect } from 'vitest';
import { check } from '../../src/analyzers/architectureCheck.js';
import type { FileEntry } from '../../src/types.js';

function makeFile(relativePath: string, sizeBytes = 500): FileEntry {
  const ext = relativePath.includes('.') ? relativePath.substring(relativePath.lastIndexOf('.')) : '';
  const dir = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '.';
  return {
    relativePath,
    absolutePath: `/proj/${relativePath}`,
    extension: ext,
    sizeBytes,
    directory: dir,
  };
}

function utilsFiles(count: number, dir = 'src/utils'): FileEntry[] {
  return Array.from({ length: count }, (_, i) => makeFile(`${dir}/helper${i}.ts`));
}

describe('architectureCheck', () => {
  describe('large utility directory detection', () => {
    it('flags utils/ with more than 10 files', async () => {
      const files = [
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
        ...utilsFiles(11, 'src/utils'),
      ];
      const issues = await check('/proj', files);
      const issue = issues.find((i) => i.id === 'large-utils-dir');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
      expect(issue!.title).toContain('11 files');
      expect(issue!.locations?.[0]?.file).toBe('src/utils');
    });

    it('does not flag utils/ with 10 or fewer files', async () => {
      const files = [
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
        ...utilsFiles(10, 'src/utils'),
      ];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'large-utils-dir')).toBeUndefined();
    });

    it.each(['helpers', 'lib', 'shared'])('flags %s/ when oversized', async (name) => {
      const files = [
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
        ...utilsFiles(11, `src/${name}`),
      ];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === `large-${name}-dir`)).toBeDefined();
    });
  });

  describe('source directory organization', () => {
    it('flags when many code files sit at project root with no src/', async () => {
      const files = [
        makeFile('a.ts'),
        makeFile('b.ts'),
        makeFile('c.ts'),
        makeFile('d.ts'),
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
      ];
      const issues = await check('/proj', files);
      const issue = issues.find((i) => i.id === 'no-source-dir');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('info');
    });

    it('does not flag when code lives under src/', async () => {
      const files = [
        makeFile('src/a.ts'),
        makeFile('src/b.ts'),
        makeFile('src/c.ts'),
        makeFile('src/d.ts'),
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
      ];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'no-source-dir')).toBeUndefined();
    });

    it('does not flag with 3 or fewer root code files', async () => {
      const files = [
        makeFile('a.ts'),
        makeFile('b.ts'),
        makeFile('c.ts'),
        makeFile('README.md', 500),
        makeFile('.editorconfig', 50),
      ];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'no-source-dir')).toBeUndefined();
    });
  });

  describe('editorconfig detection', () => {
    it('flags missing .editorconfig', async () => {
      const files = [makeFile('src/a.ts'), makeFile('README.md', 500)];
      const issues = await check('/proj', files);
      const issue = issues.find((i) => i.id === 'missing-editorconfig');
      expect(issue).toBeDefined();
      expect(issue!.fixAvailable).toBe(true);
      expect(issue!.fixId).toBe('add-editorconfig');
    });

    it('does not flag when .editorconfig is at root', async () => {
      const files = [makeFile('.editorconfig', 50), makeFile('src/a.ts'), makeFile('README.md', 500)];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'missing-editorconfig')).toBeUndefined();
    });

    it('does not treat a nested .editorconfig as root config', async () => {
      const files = [makeFile('packages/a/.editorconfig', 50), makeFile('src/a.ts'), makeFile('README.md', 500)];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'missing-editorconfig')).toBeDefined();
    });
  });

  describe('README detection', () => {
    it('flags missing README', async () => {
      const files = [makeFile('src/a.ts'), makeFile('.editorconfig', 50)];
      const issues = await check('/proj', files);
      const issue = issues.find((i) => i.id === 'missing-readme');
      expect(issue).toBeDefined();
      expect(issue!.severity).toBe('warning');
    });

    it('flags nearly-empty README (under 50 bytes)', async () => {
      const files = [makeFile('README.md', 20), makeFile('src/a.ts'), makeFile('.editorconfig', 50)];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'empty-readme')).toBeDefined();
      expect(issues.find((i) => i.id === 'missing-readme')).toBeUndefined();
    });

    it('accepts a healthy README', async () => {
      const files = [makeFile('README.md', 500), makeFile('src/a.ts'), makeFile('.editorconfig', 50)];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'missing-readme')).toBeUndefined();
      expect(issues.find((i) => i.id === 'empty-readme')).toBeUndefined();
    });

    it.each(['readme', 'README.md', 'readme.txt'])('recognises %s case-insensitively', async (name) => {
      const files = [makeFile(name, 500), makeFile('src/a.ts'), makeFile('.editorconfig', 50)];
      const issues = await check('/proj', files);
      expect(issues.find((i) => i.id === 'missing-readme')).toBeUndefined();
    });
  });

  it('sets architecture category on all emitted issues', async () => {
    const files = [makeFile('src/a.ts')];
    const issues = await check('/proj', files);
    for (const issue of issues) {
      expect(issue.category).toBe('architecture');
    }
  });
});
