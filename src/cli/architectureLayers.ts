import path from 'node:path';

import type { ArchitectureLayer, FileEntry } from '../types.js';

const FRONTEND_DIRS = ['pages', 'components', 'views', 'layouts', 'public', 'app', 'styles'];
const FRONTEND_FRAMEWORKS = [
  'React',
  'Next.js',
  'Vue.js',
  'Nuxt.js',
  'Svelte',
  'SvelteKit',
  'Angular',
  'Solid.js',
];
const API_DIRS = ['api', 'routes', 'controllers', 'endpoints'];
const API_FRAMEWORKS = ['Express', 'Fastify', 'NestJS', 'Hono', 'Koa', 'Apollo Server', 'tRPC'];
const SERVICE_DIRS = ['services', 'lib', 'core', 'domain', 'modules'];
const DB_DIRS = ['db', 'database', 'prisma', 'migrations', 'models', 'entities'];
const DB_FRAMEWORKS = ['Prisma', 'Drizzle ORM', 'Mongoose', 'TypeORM', 'Sequelize'];

export function buildArchitectureLayers(
  files: FileEntry[],
  frameworkNames: string[],
): ArchitectureLayer[] {
  const layers: ArchitectureLayer[] = [];
  const dirs = collectDirectorySignals(files);

  pushLayer(layers, {
    name: 'Frontend',
    directories: matchingDirs(dirs, FRONTEND_DIRS),
    frameworks: matchingFrameworks(frameworkNames, FRONTEND_FRAMEWORKS),
    fallbackTechnology: 'Static',
  });
  pushLayer(layers, {
    name: 'API Layer',
    directories: matchingDirs(dirs, API_DIRS),
    frameworks: matchingFrameworks(frameworkNames, API_FRAMEWORKS),
    fallbackTechnology: 'HTTP',
  });

  const serviceMatches = matchingDirs(dirs, SERVICE_DIRS);
  if (serviceMatches.length > 0) {
    layers.push({
      name: 'Services',
      technologies: inferServiceTech(files, serviceMatches),
      directories: serviceMatches,
    });
  }

  pushLayer(layers, {
    name: 'Database',
    directories: matchingDirs(dirs, DB_DIRS),
    frameworks: matchingFrameworks(frameworkNames, DB_FRAMEWORKS),
    fallbackTechnology: 'Database',
  });

  if (layers.length === 0) {
    const topDirs = [...collectTopLevelDirs(files)].slice(0, 5);
    layers.push({
      name: 'Application',
      technologies: frameworkNames.length > 0 ? frameworkNames : ['Unknown'],
      directories: topDirs,
    });
  }

  return layers;
}

function collectDirectorySignals(files: FileEntry[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    if (!file.directory || file.directory === '.') continue;
    dirs.add(file.directory);
    const topDir = file.directory.split(path.sep)[0];
    if (topDir) dirs.add(topDir);
  }
  return dirs;
}

function collectTopLevelDirs(files: FileEntry[]): Set<string> {
  const dirs = new Set<string>();
  for (const file of files) {
    const topDir = file.directory.split(path.sep)[0];
    if (topDir) dirs.add(topDir);
  }
  return dirs;
}

function pushLayer(
  layers: ArchitectureLayer[],
  input: {
    name: string;
    directories: string[];
    frameworks: string[];
    fallbackTechnology: string;
  },
): void {
  if (input.directories.length === 0 && input.frameworks.length === 0) return;
  layers.push({
    name: input.name,
    technologies: input.frameworks.length > 0 ? input.frameworks : [input.fallbackTechnology],
    directories: input.directories,
  });
}

function matchingDirs(dirs: Set<string>, candidates: string[]): string[] {
  return candidates.filter((dir) => dirs.has(dir) || dirs.has(`src/${dir}`));
}

function matchingFrameworks(frameworkNames: string[], candidates: string[]): string[] {
  return frameworkNames.filter((framework) => candidates.includes(framework));
}

function inferServiceTech(files: FileEntry[], serviceDirs: string[]): string[] {
  const techs: string[] = [];
  const serviceFiles = files.filter((f) => serviceDirs.some((d) => isInLayerDir(f.directory, d)));
  const hasTsFiles = serviceFiles.some((f) => f.extension === '.ts' || f.extension === '.tsx');
  const hasJsFiles = serviceFiles.some((f) => f.extension === '.js' || f.extension === '.jsx');
  if (hasTsFiles) techs.push('TypeScript');
  else if (hasJsFiles) techs.push('JavaScript');
  if (techs.length === 0) techs.push('Mixed');
  return techs;
}

function isInLayerDir(directory: string, layerDir: string): boolean {
  return (
    directory === layerDir ||
    directory.startsWith(`${layerDir}${path.sep}`) ||
    directory === `src${path.sep}${layerDir}` ||
    directory.startsWith(`src${path.sep}${layerDir}${path.sep}`)
  );
}
