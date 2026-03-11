import { describe, it, expect } from 'vitest';
import { detectLanguages } from '../../src/core/languageDetector.js';
import type { FileEntry } from '../../src/types.js';

function makeFile(relativePath: string, ext?: string): FileEntry {
  return {
    relativePath,
    absolutePath: `/root/project/${relativePath}`,
    extension: ext ?? relativePath.substring(relativePath.lastIndexOf('.')),
    sizeBytes: 100,
    directory: relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '.',
  };
}

describe('detectLanguages', () => {
  it('should detect a single-language TypeScript project', () => {
    const files = [
      makeFile('src/index.ts'),
      makeFile('src/utils.ts'),
      makeFile('src/app.tsx'),
    ];

    const result = detectLanguages(files);
    expect(result.primary).toBe('TypeScript');
    expect(result.languages['TypeScript'].fileCount).toBe(3);
    expect(result.languages['TypeScript'].percentage).toBe(100);
  });

  it('should identify primary language in a multi-language project', () => {
    const files = [
      makeFile('src/index.ts'),
      makeFile('src/utils.ts'),
      makeFile('src/app.ts'),
      makeFile('styles/main.css'),
      makeFile('public/index.html'),
    ];

    const result = detectLanguages(files);
    expect(result.primary).toBe('TypeScript');
    expect(Object.keys(result.languages).length).toBe(3); // TS, CSS, HTML
  });

  it('should exclude JSON/Markdown/YAML from primary language', () => {
    const files = [
      makeFile('package.json', '.json'),
      makeFile('tsconfig.json', '.json'),
      makeFile('README.md', '.md'),
      makeFile('config.yml', '.yml'),
      makeFile('src/index.ts'),
    ];

    const result = detectLanguages(files);
    expect(result.primary).toBe('TypeScript');
  });

  it('should return Unknown for unrecognized extensions only', () => {
    const files = [
      makeFile('data.xyz', '.xyz'),
      makeFile('other.abc', '.abc'),
    ];

    const result = detectLanguages(files);
    expect(result.primary).toBe('Unknown');
    expect(Object.keys(result.languages).length).toBe(0);
  });

  it('should group .ts and .tsx under TypeScript', () => {
    const files = [
      makeFile('src/index.ts'),
      makeFile('src/App.tsx'),
    ];

    const result = detectLanguages(files);
    expect(result.languages['TypeScript'].fileCount).toBe(2);
    expect(result.languages['TypeScript'].extensions).toContain('.ts');
    expect(result.languages['TypeScript'].extensions).toContain('.tsx');
  });

  it('should compute correct percentages', () => {
    const files = [
      makeFile('a.ts'),
      makeFile('b.ts'),
      makeFile('c.js'),
      makeFile('d.js'),
    ];

    const result = detectLanguages(files);
    expect(result.languages['TypeScript'].percentage).toBe(50);
    expect(result.languages['JavaScript'].percentage).toBe(50);
  });

  it('should handle empty file list', () => {
    const result = detectLanguages([]);
    expect(result.primary).toBe('Unknown');
    expect(Object.keys(result.languages).length).toBe(0);
  });
});
