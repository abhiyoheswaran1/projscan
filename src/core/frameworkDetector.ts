import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, FrameworkResult, DetectedFramework } from '../types.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

// Maps dependency name → framework info
const DEPENDENCY_FRAMEWORKS: Record<
  string,
  { name: string; category: DetectedFramework['category'] }
> = {
  react: { name: 'React', category: 'frontend' },
  'react-dom': { name: 'React', category: 'frontend' },
  next: { name: 'Next.js', category: 'frontend' },
  vue: { name: 'Vue.js', category: 'frontend' },
  nuxt: { name: 'Nuxt.js', category: 'frontend' },
  svelte: { name: 'Svelte', category: 'frontend' },
  '@sveltejs/kit': { name: 'SvelteKit', category: 'frontend' },
  angular: { name: 'Angular', category: 'frontend' },
  '@angular/core': { name: 'Angular', category: 'frontend' },
  solid: { name: 'Solid.js', category: 'frontend' },
  'solid-js': { name: 'Solid.js', category: 'frontend' },
  express: { name: 'Express', category: 'backend' },
  fastify: { name: 'Fastify', category: 'backend' },
  '@nestjs/core': { name: 'NestJS', category: 'backend' },
  hono: { name: 'Hono', category: 'backend' },
  koa: { name: 'Koa', category: 'backend' },
  'socket.io': { name: 'Socket.IO', category: 'backend' },
  vitest: { name: 'Vitest', category: 'testing' },
  jest: { name: 'Jest', category: 'testing' },
  mocha: { name: 'Mocha', category: 'testing' },
  cypress: { name: 'Cypress', category: 'testing' },
  playwright: { name: 'Playwright', category: 'testing' },
  '@playwright/test': { name: 'Playwright', category: 'testing' },
  vite: { name: 'Vite', category: 'bundler' },
  webpack: { name: 'Webpack', category: 'bundler' },
  rollup: { name: 'Rollup', category: 'bundler' },
  esbuild: { name: 'esbuild', category: 'bundler' },
  turbo: { name: 'Turborepo', category: 'bundler' },
  tailwindcss: { name: 'Tailwind CSS', category: 'css' },
  'styled-components': { name: 'styled-components', category: 'css' },
  '@emotion/react': { name: 'Emotion', category: 'css' },
  prisma: { name: 'Prisma', category: 'other' },
  '@prisma/client': { name: 'Prisma', category: 'other' },
  drizzle: { name: 'Drizzle ORM', category: 'other' },
  'drizzle-orm': { name: 'Drizzle ORM', category: 'other' },
  mongoose: { name: 'Mongoose', category: 'other' },
  typeorm: { name: 'TypeORM', category: 'other' },
  sequelize: { name: 'Sequelize', category: 'other' },
  graphql: { name: 'GraphQL', category: 'other' },
  'apollo-server': { name: 'Apollo Server', category: 'backend' },
  '@apollo/server': { name: 'Apollo Server', category: 'backend' },
  trpc: { name: 'tRPC', category: 'backend' },
  '@trpc/server': { name: 'tRPC', category: 'backend' },
};

const BUILD_TOOL_INDICATORS: Record<string, string> = {
  'tsconfig.json': 'TypeScript',
  'webpack.config.js': 'Webpack',
  'webpack.config.ts': 'Webpack',
  'rollup.config.js': 'Rollup',
  'rollup.config.ts': 'Rollup',
  'vite.config.js': 'Vite',
  'vite.config.ts': 'Vite',
  'turbo.json': 'Turborepo',
  'Makefile': 'Make',
  'Dockerfile': 'Docker',
  'docker-compose.yml': 'Docker Compose',
  'docker-compose.yaml': 'Docker Compose',
};

export async function detectFrameworks(
  rootPath: string,
  files: FileEntry[],
): Promise<FrameworkResult> {
  const pkg = await readPackageJson(rootPath);
  const fileNames = new Set(files.map((f) => f.relativePath));
  const rootFiles = new Set(files.filter((f) => !f.directory || f.directory === '.').map((f) => path.basename(f.relativePath)));

  const frameworks = new Map<string, DetectedFramework>();

  // Detect from package.json dependencies
  if (pkg) {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [dep, info] of Object.entries(DEPENDENCY_FRAMEWORKS)) {
      if (allDeps[dep]) {
        if (!frameworks.has(info.name)) {
          frameworks.set(info.name, {
            name: info.name,
            version: allDeps[dep],
            category: info.category,
            confidence: 'high',
          });
        }
      }
    }
  }

  // Detect from config files
  for (const file of rootFiles) {
    // Next.js config
    if (file.startsWith('next.config')) {
      if (!frameworks.has('Next.js')) {
        frameworks.set('Next.js', {
          name: 'Next.js',
          category: 'frontend',
          confidence: 'high',
        });
      }
    }
    // Tailwind config
    if (file.startsWith('tailwind.config')) {
      if (!frameworks.has('Tailwind CSS')) {
        frameworks.set('Tailwind CSS', {
          name: 'Tailwind CSS',
          category: 'css',
          confidence: 'high',
        });
      }
    }
  }

  // Detect from special directories
  if (fileNames.has('prisma/schema.prisma')) {
    if (!frameworks.has('Prisma')) {
      frameworks.set('Prisma', {
        name: 'Prisma',
        category: 'other',
        confidence: 'high',
      });
    }
  }

  // Detect build tools
  const buildTools: string[] = [];
  for (const [file, tool] of Object.entries(BUILD_TOOL_INDICATORS)) {
    if (rootFiles.has(file) || fileNames.has(file)) {
      if (!buildTools.includes(tool)) {
        buildTools.push(tool);
      }
    }
  }

  // Detect package manager
  const packageManager = detectPackageManager(rootFiles);

  return {
    frameworks: [...frameworks.values()],
    buildTools,
    packageManager,
  };
}

function detectPackageManager(rootFiles: Set<string>): FrameworkResult['packageManager'] {
  if (rootFiles.has('pnpm-lock.yaml')) return 'pnpm';
  if (rootFiles.has('yarn.lock')) return 'yarn';
  if (rootFiles.has('package-lock.json')) return 'npm';
  return 'unknown';
}

async function readPackageJson(rootPath: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}
