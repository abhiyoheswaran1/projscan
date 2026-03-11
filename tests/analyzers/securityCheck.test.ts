import { describe, it, expect, vi, beforeEach } from 'vitest';
import { check } from '../../src/analyzers/securityCheck.js';
import type { FileEntry } from '../../src/types.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

function makeFile(relativePath: string, sizeBytes = 100): FileEntry {
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

describe('securityCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('env file detection', () => {
    it('should flag .env file', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return '';
      });
      const files = [makeFile('.env'), makeFile('src/index.ts')];
      const issues = await check('/proj', files);
      const envIssue = issues.find((i) => i.id === 'env-file-committed');
      expect(envIssue).toBeDefined();
      expect(envIssue!.severity).toBe('warning');
    });

    it('should flag .env.local but not .env.example', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return '';
      });
      const files = [makeFile('.env.local'), makeFile('.env.example'), makeFile('src/index.ts')];
      const issues = await check('/proj', files);
      const envIssues = issues.filter((i) => i.id === 'env-file-committed');
      expect(envIssues).toHaveLength(1);
      expect(envIssues[0].title).toContain('.env.local');
    });

    it('should not flag .env.sample or .env.template', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return '';
      });
      const files = [makeFile('.env.sample'), makeFile('.env.template')];
      const issues = await check('/proj', files);
      const envIssues = issues.filter((i) => i.id === 'env-file-committed');
      expect(envIssues).toHaveLength(0);
    });
  });

  describe('private key detection', () => {
    it('should flag .pem and .key files', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return '';
      });
      const files = [makeFile('certs/server.pem'), makeFile('keys/app.key')];
      const issues = await check('/proj', files);
      const keyIssues = issues.filter((i) => i.id === 'private-key-committed');
      expect(keyIssues).toHaveLength(2);
      expect(keyIssues[0].severity).toBe('error');
    });

    it('should flag id_rsa file', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return '';
      });
      const files = [makeFile('deploy/id_rsa')];
      const issues = await check('/proj', files);
      const keyIssue = issues.find((i) => i.id === 'private-key-committed');
      expect(keyIssue).toBeDefined();
    });
  });

  describe('hardcoded secret detection', () => {
    it('should detect AWS access keys', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        if (String(p).endsWith('config.ts')) return 'const key = "AKIAIOSFODNN7EXAMPLE";';
        return '';
      });
      const files = [makeFile('src/config.ts')];
      const issues = await check('/proj', files);
      const secretIssue = issues.find((i) => i.id === 'hardcoded-secret');
      expect(secretIssue).toBeDefined();
      expect(secretIssue!.severity).toBe('error');
      expect(secretIssue!.title).toContain('AWS Access Key');
    });

    it('should detect GitHub tokens', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        if (String(p).endsWith('auth.ts'))
          return 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";';
        return '';
      });
      const files = [makeFile('src/auth.ts')];
      const issues = await check('/proj', files);
      const secretIssue = issues.find((i) => i.id === 'hardcoded-secret');
      expect(secretIssue).toBeDefined();
      expect(secretIssue!.title).toContain('GitHub Token');
    });

    it('should detect generic password patterns', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        if (String(p).endsWith('db.ts')) return 'password = "super-secret-password123"';
        return '';
      });
      const files = [makeFile('src/db.ts')];
      const issues = await check('/proj', files);
      const secretIssue = issues.find((i) => i.id === 'hardcoded-secret');
      expect(secretIssue).toBeDefined();
    });

    it('should skip files over 512KB', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return '.env\n';
        return 'AKIAIOSFODNN7EXAMPLE';
      });
      const files = [makeFile('src/big.ts', 600 * 1024)];
      const issues = await check('/proj', files);
      const secretIssue = issues.find((i) => i.id === 'hardcoded-secret');
      expect(secretIssue).toBeUndefined();
    });
  });

  describe('gitignore .env check', () => {
    it('should flag when .gitignore is missing .env', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return 'node_modules/\ndist/\n';
        return '';
      });
      const files = [makeFile('src/index.ts')];
      const issues = await check('/proj', files);
      const gitignoreIssue = issues.find((i) => i.id === 'gitignore-missing-env');
      expect(gitignoreIssue).toBeDefined();
    });

    it('should not flag when .gitignore contains .env', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) return 'node_modules/\n.env\n';
        return '';
      });
      const files = [makeFile('src/index.ts')];
      const issues = await check('/proj', files);
      const gitignoreIssue = issues.find((i) => i.id === 'gitignore-missing-env');
      expect(gitignoreIssue).toBeUndefined();
    });

    it('should flag when no .gitignore exists', async () => {
      vi.mocked(fs.readFile).mockImplementation(async (p) => {
        if (String(p).endsWith('.gitignore')) throw new Error('ENOENT');
        return '';
      });
      const files = [makeFile('src/index.ts')];
      const issues = await check('/proj', files);
      const gitignoreIssue = issues.find((i) => i.id === 'gitignore-missing-env');
      expect(gitignoreIssue).toBeDefined();
    });
  });

  it('should set category to security for all issues', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith('.gitignore')) return 'node_modules/\n';
      if (String(p).endsWith('config.ts')) return 'const key = "AKIAIOSFODNN7EXAMPLE";';
      return '';
    });
    const files = [makeFile('.env'), makeFile('certs/server.pem'), makeFile('src/config.ts')];
    const issues = await check('/proj', files);
    for (const issue of issues) {
      expect(issue.category).toBe('security');
    }
  });
});
