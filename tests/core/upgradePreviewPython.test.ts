import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { previewUpgrade } from '../../src/core/upgradePreview.js';
import { makeUpgradePreviewTempDir, writeFileEntry, writeJson } from '../helpers/upgradePreview.js';

describe('previewUpgrade Python evidence', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeUpgradePreviewTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('previews Poetry dependency impact with Python importers', async () => {
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      [
        '[tool.poetry]',
        'name = "py-app"',
        'version = "0.1.0"',
        '',
        '[tool.poetry.dependencies]',
        'python = "^3.12"',
        'requests = "^2.31.0"',
      ].join('\n'),
    );
    const files = [await writeFileEntry(tmp, 'pkg/client.py', 'import requests\n')];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('^2.31.0');
    expect(preview.installed).toBeNull();
    expect(preview.latest).toBeNull();
    expect(preview.drift).toBe('unknown');
    expect(preview.declaredSource).toBe('pyproject.toml');
    expect(preview.declaredLine).toBe(7);
    expect(preview.declaredScope).toBe('main');
    expect(preview.importers).toEqual(['pkg/client.py']);
  });

  it('previews pyproject dependency-group entries as Python dev-scope evidence', async () => {
    const pyproject = [
      '[project]',
      'name = "py-app"',
      '',
      '[dependency-groups]',
      'dev = ["pytest>=8"]',
    ].join('\n');
    const files = [
      await writeFileEntry(tmp, 'pyproject.toml', pyproject),
      await writeFileEntry(tmp, 'tests/test_app.py', 'import pytest\n'),
    ];

    const preview = await previewUpgrade(tmp, 'pytest', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=8');
    expect(preview.declaredSource).toBe('pyproject.toml');
    expect(preview.declaredScope).toBe('dev');
    expect(preview.importers).toEqual(['tests/test_app.py']);
  });

  it('previews Python dependencies from pyproject even before Python files exist', async () => {
    const files = [
      await writeFileEntry(
        tmp,
        'pyproject.toml',
        ['[project]', 'name = "py-app"', 'dependencies = ["requests>=2"]'].join('\n'),
      ),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=2');
    expect(preview.declaredSource).toBe('pyproject.toml');
    expect(preview.declaredScope).toBe('main');
    expect(preview.importers).toEqual([]);
  });

  it('previews numeric-leading Python dependencies from pyproject evidence', async () => {
    const files = [
      await writeFileEntry(
        tmp,
        'pyproject.toml',
        ['[project]', 'name = "py-app"', 'dependencies = ["3to2>=1.1.1"]'].join('\n'),
      ),
    ];

    const preview = await previewUpgrade(tmp, '3to2', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=1.1.1');
    expect(preview.declaredSource).toBe('pyproject.toml');
    expect(preview.declaredScope).toBe('main');
    expect(preview.importers).toEqual([]);
  });

  it('falls back to Python evidence when an npm declaration is not installed', async () => {
    await writeJson(path.join(tmp, 'package.json'), { dependencies: { requests: '^0.0.1' } });
    const files = [
      await writeFileEntry(
        tmp,
        'pyproject.toml',
        ['[project]', 'name = "py-app"', 'dependencies = ["requests>=2.31.0"]'].join('\n'),
      ),
      await writeFileEntry(tmp, 'pkg/client.py', 'import requests\n'),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=2.31.0');
    expect(preview.declaredSource).toBe('pyproject.toml');
    expect(preview.importers).toEqual(['pkg/client.py']);
  });

  it('uses poetry.lock as Python current-version evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      [
        '[tool.poetry]',
        'name = "py-app"',
        'version = "0.1.0"',
        '',
        '[tool.poetry.dependencies]',
        'python = "^3.12"',
        'requests = "^2.30.0"',
      ].join('\n'),
    );
    await fs.writeFile(
      path.join(tmp, 'poetry.lock'),
      ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
    );
    const files = [await writeFileEntry(tmp, 'pkg/client.py', 'import requests\n')];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('^2.30.0');
    expect(preview.installed).toBe('2.31.0');
    expect(preview.latest).toBe('2.31.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('poetry.lock');
    expect(preview.installedLine).toBe(3);
  });

  it('previews requirements.txt dependency impact with Python importers', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'fastapi==0.110.0\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'fastapi==0.110.0\n'),
      await writeFileEntry(tmp, 'app/main.py', 'from fastapi import FastAPI\n'),
    ];

    const preview = await previewUpgrade(tmp, 'fastapi', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('==0.110.0');
    expect(preview.declaredSource).toBe('requirements.txt');
    expect(preview.importers).toEqual(['app/main.py']);
  });

  it('previews requirements.in dependency impact without installed-version evidence', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.in'), 'fastapi==0.110.0\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.in', 'fastapi==0.110.0\n'),
      await writeFileEntry(tmp, 'app/main.py', 'from fastapi import FastAPI\n'),
    ];

    const preview = await previewUpgrade(tmp, 'fastapi', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('==0.110.0');
    expect(preview.installed).toBeNull();
    expect(preview.latest).toBeNull();
    expect(preview.drift).toBe('unknown');
    expect(preview.declaredSource).toBe('requirements.in');
    expect(preview.declaredLine).toBe(1);
    expect(preview.importers).toEqual(['app/main.py']);
  });

  it('previews packages declared by included requirements files', async () => {
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', '-r requirements/base.txt\n'),
      await writeFileEntry(tmp, 'requirements/base.txt', 'httpx>=0.27\n'),
      await writeFileEntry(tmp, 'app/client.py', 'import httpx\n'),
    ];

    const preview = await previewUpgrade(tmp, 'httpx', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.27');
    expect(preview.declaredSource).toBe('requirements/base.txt');
    expect(preview.declaredLine).toBe(1);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses included constraints as Python current-version evidence', async () => {
    const files = [
      await writeFileEntry(
        tmp,
        'requirements.txt',
        ['httpx>=0.27.0', '-c constraints/prod.txt'].join('\n'),
      ),
      await writeFileEntry(tmp, 'constraints/prod.txt', 'httpx==0.27.2\n'),
      await writeFileEntry(tmp, 'app/client.py', 'import httpx\n'),
    ];

    const preview = await previewUpgrade(tmp, 'httpx', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.27.0');
    expect(preview.installed).toBe('0.27.2');
    expect(preview.latest).toBe('0.27.2');
    expect(preview.drift).toBe('patch');
    expect(preview.installedSource).toBe('constraints/prod.txt');
    expect(preview.installedLine).toBe(1);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses pinned root requirements as Python current-version evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      ['[project]', 'name = "py-app"', 'dependencies = ["fastapi>=0.109.0"]'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'fastapi==0.110.0\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'fastapi==0.110.0\n'),
      await writeFileEntry(tmp, 'app/main.py', 'from fastapi import FastAPI\n'),
    ];

    const preview = await previewUpgrade(tmp, 'fastapi', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.109.0');
    expect(preview.installed).toBe('0.110.0');
    expect(preview.latest).toBe('0.110.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('requirements.txt');
    expect(preview.installedLine).toBe(1);
  });

  it('previews nested requirements manifests without a root include', async () => {
    const files = [
      await writeFileEntry(tmp, 'requirements/base.txt', 'httpx>=0.27.0\n'),
      await writeFileEntry(tmp, 'requirements/prod.txt', 'httpx==0.27.2\n'),
      await writeFileEntry(tmp, 'app/client.py', 'import httpx\n'),
    ];

    const preview = await previewUpgrade(tmp, 'httpx', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.27.0');
    expect(preview.declaredSource).toBe('requirements/base.txt');
    expect(preview.installed).toBe('0.27.2');
    expect(preview.installedSource).toBe('requirements/prod.txt');
    expect(preview.installedLine).toBe(1);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses pinned constraints as Python current-version evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      ['[project]', 'name = "py-app"', 'dependencies = ["fastapi>=0.109.0"]'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'constraints.txt'), 'fastapi==0.110.0\n');
    const files = [
      await writeFileEntry(tmp, 'constraints.txt', 'fastapi==0.110.0\n'),
      await writeFileEntry(tmp, 'app/main.py', 'from fastapi import FastAPI\n'),
    ];

    const preview = await previewUpgrade(tmp, 'fastapi', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.109.0');
    expect(preview.installed).toBe('0.110.0');
    expect(preview.latest).toBe('0.110.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('constraints.txt');
    expect(preview.installedLine).toBe(1);
  });

  it('previews nested constraints manifests without a root include', async () => {
    const files = [
      await writeFileEntry(
        tmp,
        'pyproject.toml',
        ['[project]', 'name = "py-app"', 'dependencies = ["fastapi>=0.109.0"]'].join('\n'),
      ),
      await writeFileEntry(tmp, 'constraints/prod.txt', 'fastapi==0.110.0\n'),
      await writeFileEntry(tmp, 'app/main.py', 'from fastapi import FastAPI\n'),
    ];

    const preview = await previewUpgrade(tmp, 'fastapi', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.109.0');
    expect(preview.installed).toBe('0.110.0');
    expect(preview.installedSource).toBe('constraints/prod.txt');
    expect(preview.installedLine).toBe(1);
    expect(preview.importers).toEqual(['app/main.py']);
  });

  it('uses Pipfile.lock as Python current-version evidence', async () => {
    const pipfileLock = JSON.stringify({ default: { requests: { version: '==2.31.0' } } });
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'requests==2.30.0\n'),
      await writeFileEntry(tmp, 'Pipfile.lock', pipfileLock),
      await writeFileEntry(tmp, 'app/client.py', 'import requests\n'),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.installed).toBe('2.31.0');
    expect(preview.latest).toBe('2.31.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('Pipfile.lock');
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses uv.lock as Python current-version evidence', async () => {
    const uvLock = ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'requests==2.30.0\n'),
      await writeFileEntry(tmp, 'uv.lock', uvLock),
      await writeFileEntry(tmp, 'app/client.py', 'import requests\n'),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.installed).toBe('2.31.0');
    expect(preview.latest).toBe('2.31.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('uv.lock');
    expect(preview.installedLine).toBe(3);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses later supported Python lockfiles when earlier lockfiles lack the package', async () => {
    const files = [
      await writeFileEntry(
        tmp,
        'pyproject.toml',
        ['[project]', 'name = "py-app"', 'dependencies = ["httpx>=0.27"]'].join('\n'),
      ),
      await writeFileEntry(
        tmp,
        'poetry.lock',
        ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
      ),
      await writeFileEntry(
        tmp,
        'uv.lock',
        ['[[package]]', 'name = "httpx"', 'version = "0.27.2"'].join('\n'),
      ),
      await writeFileEntry(tmp, 'app/client.py', 'import httpx\n'),
    ];

    const preview = await previewUpgrade(tmp, 'httpx', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.declared).toBe('>=0.27');
    expect(preview.installed).toBe('0.27.2');
    expect(preview.latest).toBe('0.27.2');
    expect(preview.installedSource).toBe('uv.lock');
    expect(preview.installedLine).toBe(3);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses pdm.lock as Python current-version evidence', async () => {
    const pdmLock = ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'requests==2.30.0\n'),
      await writeFileEntry(tmp, 'pdm.lock', pdmLock),
      await writeFileEntry(tmp, 'app/client.py', 'import requests\n'),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.installed).toBe('2.31.0');
    expect(preview.latest).toBe('2.31.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('pdm.lock');
    expect(preview.installedLine).toBe(3);
    expect(preview.importers).toEqual(['app/client.py']);
  });

  it('uses conda-lock.yml as Python current-version evidence', async () => {
    const condaLock = ['package:', '  - name: requests', '    version: "2.31.0"'].join('\n');
    const files = [
      await writeFileEntry(tmp, 'requirements.txt', 'requests==2.30.0\n'),
      await writeFileEntry(tmp, 'conda-lock.yml', condaLock),
      await writeFileEntry(tmp, 'app/client.py', 'import requests\n'),
    ];

    const preview = await previewUpgrade(tmp, 'requests', files);

    expect(preview.available).toBe(true);
    expect(preview.ecosystem).toBe('python');
    expect(preview.installed).toBe('2.31.0');
    expect(preview.latest).toBe('2.31.0');
    expect(preview.drift).toBe('minor');
    expect(preview.installedSource).toBe('conda-lock.yml');
    expect(preview.installedLine).toBe(3);
    expect(preview.importers).toEqual(['app/client.py']);
  });
});
