import { describe, expect, it } from 'vitest';
import { buildArchitectureLayers } from '../../src/cli/architectureLayers.js';
import type { FileEntry } from '../../src/types.js';

describe('buildArchitectureLayers', () => {
  it('infers common frontend, API, service, and database layers', () => {
    const layers = buildArchitectureLayers(
      [
        file('components/Button.tsx'),
        file('routes/users.ts'),
        file('services/auth.ts'),
        file('prisma/schema.prisma', '.prisma'),
      ],
      ['React', 'Fastify', 'Prisma'],
    );

    expect(layers).toEqual([
      { name: 'Frontend', technologies: ['React'], directories: ['components'] },
      { name: 'API Layer', technologies: ['Fastify'], directories: ['routes'] },
      { name: 'Services', technologies: ['TypeScript'], directories: ['services'] },
      { name: 'Database', technologies: ['Prisma'], directories: ['prisma'] },
    ]);
  });

  it('recognizes known layer directories below src', () => {
    const layers = buildArchitectureLayers(
      [
        file('src/components/Button.tsx', '.tsx'),
        file('src/routes/users.ts'),
        file('src/services/auth.ts'),
        file('src/prisma/schema.prisma', '.prisma'),
      ],
      [],
    );

    expect(layers).toEqual([
      { name: 'Frontend', technologies: ['Static'], directories: ['components'] },
      { name: 'API Layer', technologies: ['HTTP'], directories: ['routes'] },
      { name: 'Services', technologies: ['TypeScript'], directories: ['services'] },
      { name: 'Database', technologies: ['Database'], directories: ['prisma'] },
    ]);
  });

  it('falls back to an application layer when no known layer signal exists', () => {
    expect(buildArchitectureLayers([file('tools/check.mjs', '.mjs')], [])).toEqual([
      { name: 'Application', technologies: ['Unknown'], directories: ['tools'] },
    ]);
  });
});

function file(relativePath: string, extension = '.ts'): FileEntry {
  const directory = relativePath.split('/').slice(0, -1).join('/') || '.';
  return {
    relativePath,
    absolutePath: `/repo/${relativePath}`,
    extension,
    sizeBytes: 100,
    directory,
  };
}
