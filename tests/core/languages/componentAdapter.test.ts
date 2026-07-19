import { describe, it, expect } from 'vitest';
import {
  componentAdapter,
  extractComponentScript,
} from '../../../src/core/languages/componentAdapter.js';

describe('extractComponentScript', () => {
  it('keeps astro frontmatter and drops template markup', () => {
    const script = extractComponentScript(
      '---\nimport { a } from "./a.js";\n---\n<div>{a}</div>\n',
    );
    expect(script).toContain('import { a } from "./a.js";');
    expect(script).not.toContain('<div>');
  });

  it('preserves line numbers of the script region', () => {
    const source = '<template>\n  <p>hi</p>\n</template>\n<script>\nimport { a } from "./a.js";\n</script>\n';
    const script = extractComponentScript(source);
    const importLine = script.split('\n').findIndex((l) => l.includes('import'));
    const sourceLine = source.split('\n').findIndex((l) => l.includes('import'));
    expect(importLine).toBe(sourceLine);
  });

  it('keeps every script block when a component has several', () => {
    const script = extractComponentScript(
      '<script>\nimport { a } from "./a.js";\n</script>\n<script setup>\nimport { b } from "./b.js";\n</script>\n',
    );
    expect(script).toContain('./a.js');
    expect(script).toContain('./b.js');
  });

  it('returns empty string for a component with no script region', () => {
    expect(extractComponentScript('<div>static markup only</div>\n')).toBe('');
  });

  it('does not treat a mid-file --- as astro frontmatter', () => {
    const script = extractComponentScript('<div>a</div>\n---\nnot frontmatter\n---\n');
    expect(script).not.toContain('not frontmatter');
  });
});

describe('componentAdapter', () => {
  it('claims the single-file component extensions', () => {
    expect([...componentAdapter.extensions].sort()).toEqual(['.astro', '.svelte', '.vue']);
  });

  it('never marks a component file as dead-code flaggable', () => {
    expect([...(componentAdapter.sourceExtensions ?? [])]).toEqual([]);
  });

  it('parses imports out of astro frontmatter', async () => {
    const result = await componentAdapter.parse(
      'src/pages/index.astro',
      '---\nimport { zurichMap } from "../data/zurichMap.js";\n---\n<div>{zurichMap.lat}</div>\n',
    );
    expect(result.ok).toBe(true);
    expect(result.imports.map((i) => i.source)).toContain('../data/zurichMap.js');
  });

  it('parses typescript syntax in a vue script setup block', async () => {
    const result = await componentAdapter.parse(
      'src/components/Card.vue',
      '<template><p /></template>\n<script setup lang="ts">\nimport type { Foo } from "./foo.js";\nconst x: Foo | null = null;\n</script>\n',
    );
    expect(result.ok).toBe(true);
    expect(result.imports.map((i) => i.source)).toContain('./foo.js');
  });

  it('does not throw on a component with unparseable script content', async () => {
    const result = await componentAdapter.parse('broken.svelte', '<script>\n}{ (((\n</script>\n');
    expect(result).toBeDefined();
    expect(Array.isArray(result.imports)).toBe(true);
  });
});
