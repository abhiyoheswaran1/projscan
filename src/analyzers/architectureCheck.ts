import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';

const LARGE_DIR_THRESHOLD = 10;
const SUSPECT_DIRS = ['utils', 'helpers', 'lib', 'shared'];

export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const issues: Issue[] = [];

  // Check for large utility directories
  const dirFileCounts = new Map<string, number>();
  for (const file of files) {
    const parts = file.directory.split(path.sep);
    for (const part of parts) {
      if (SUSPECT_DIRS.includes(part)) {
        const key = file.directory;
        dirFileCounts.set(key, (dirFileCounts.get(key) ?? 0) + 1);
      }
    }
  }

  for (const [dir, count] of dirFileCounts) {
    if (count > LARGE_DIR_THRESHOLD) {
      const dirName = path.basename(dir);
      issues.push({
        id: `large-${dirName}-dir`,
        title: `Large ${dirName}/ directory (${count} files)`,
        description: `The ${dir}/ directory contains ${count} files. Consider splitting into domain-specific modules for better organization.`,
        severity: 'warning',
        category: 'architecture',
        fixAvailable: false,
      });
    }
  }

  // Check for missing source directory organization
  const hasSourceDir = files.some((f) => {
    const topDir = f.directory.split(path.sep)[0];
    return ['src', 'lib', 'app', 'pages', 'source'].includes(topDir);
  });

  const hasCodeFiles = files.some((f) =>
    ['.js', '.jsx', '.ts', '.tsx', '.py', '.go', '.rs', '.java'].includes(f.extension),
  );

  if (hasCodeFiles && !hasSourceDir) {
    const rootCodeFiles = files.filter(
      (f) =>
        (!f.directory || f.directory === '.') &&
        ['.js', '.jsx', '.ts', '.tsx'].includes(f.extension),
    );
    if (rootCodeFiles.length > 3) {
      issues.push({
        id: 'no-source-dir',
        title: 'No source directory organization',
        description:
          'Source code files are at the project root without a src/ or app/ directory. Consider organizing code into a source directory.',
        severity: 'info',
        category: 'architecture',
        fixAvailable: false,
      });
    }
  }

  // Check for missing .editorconfig
  const hasEditorConfig = files.some(
    (f) => path.basename(f.relativePath) === '.editorconfig' && (!f.directory || f.directory === '.'),
  );
  if (!hasEditorConfig) {
    issues.push({
      id: 'missing-editorconfig',
      title: 'Missing .editorconfig',
      description:
        'No .editorconfig file found. EditorConfig helps maintain consistent coding styles across different editors.',
      severity: 'info',
      category: 'architecture',
      fixAvailable: true,
      fixId: 'add-editorconfig',
    });
  }

  // Check for missing or empty README
  const readmeFile = files.find((f) => {
    const name = path.basename(f.relativePath).toLowerCase();
    return (
      (name === 'readme.md' || name === 'readme' || name === 'readme.txt') &&
      (!f.directory || f.directory === '.')
    );
  });

  if (!readmeFile) {
    issues.push({
      id: 'missing-readme',
      title: 'Missing README',
      description:
        'No README file found. A README is essential for project documentation and onboarding.',
      severity: 'warning',
      category: 'architecture',
      fixAvailable: false,
    });
  } else if (readmeFile.sizeBytes < 50) {
    issues.push({
      id: 'empty-readme',
      title: 'README is nearly empty',
      description:
        'The README file contains very little content. Consider adding project description, setup instructions, and usage examples.',
      severity: 'info',
      category: 'architecture',
      fixAvailable: false,
    });
  }

  return issues;
}
