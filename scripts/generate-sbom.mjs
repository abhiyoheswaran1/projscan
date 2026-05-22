#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const output = path.join(root, 'dist', 'projscan-sbom.cdx.json');

const rootRef = `pkg:npm/${encodePackageName(pkg.name)}@${pkg.version}`;
const components = [];

for (const [entryPath, entry] of Object.entries(lock.packages ?? {})) {
  if (entryPath === '') continue;
  const name = packageNameFromLockPath(entryPath);
  const version = typeof entry.version === 'string' ? entry.version : null;
  if (!name || !version) continue;
  components.push({
    type: 'library',
    'bom-ref': `pkg:npm/${encodePackageName(name)}@${version}`,
    name,
    version,
    purl: `pkg:npm/${encodePackageName(name)}@${version}`,
    ...(entry.license ? { licenses: [{ license: { id: String(entry.license) } }] } : {}),
  });
}

components.sort((a, b) => `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    tools: [
      {
        vendor: 'projscan',
        name: 'projscan-sbom-generator',
        version: pkg.version,
      },
    ],
    component: {
      type: 'application',
      'bom-ref': rootRef,
      name: pkg.name,
      version: pkg.version,
      purl: rootRef,
    },
  },
  components,
};

mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`wrote ${path.relative(root, output)} with ${components.length} components`);

function packageNameFromLockPath(entryPath) {
  const marker = 'node_modules/';
  const markerIndex = entryPath.lastIndexOf(marker);
  if (markerIndex === -1) return null;
  const last = entryPath.slice(markerIndex + marker.length);
  if (!last) return null;
  const segments = last.split('/');
  if (segments[0]?.startsWith('@') && segments[1]) return `${segments[0]}/${segments[1]}`;
  return segments[0] || null;
}

function encodePackageName(name) {
  return name.split('/').map(encodeURIComponent).join('/');
}
