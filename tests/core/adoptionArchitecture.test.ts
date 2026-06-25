import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';

test('adoption keeps MCP config catalog in a focused helper', () => {
  const adoptionSource = readFileSync('src/core/adoption.ts', 'utf8');
  const mcpConfigSource = readFileSync('src/core/adoptionMcpConfig.ts', 'utf8');

  expect(adoptionSource).toContain("from './adoptionMcpConfig.js'");
  expect(adoptionSource).not.toContain('const CLIENTS:');
  expect(mcpConfigSource).toContain('const CLIENTS:');
  expect(mcpConfigSource).toContain('export function getMcpConfigGuide');
});

test('adoption keeps workflow recipes in a focused helper', () => {
  const adoptionSource = readFileSync('src/core/adoption.ts', 'utf8');
  const workflowSource = readFileSync('src/core/adoptionWorkflowRecipes.ts', 'utf8');

  expect(adoptionSource).toContain("from './adoptionWorkflowRecipes.js'");
  expect(adoptionSource).not.toContain("id: 'before_edit'");
  expect(workflowSource).toContain("id: 'before_edit'");
  expect(workflowSource).toContain('export function getWorkflowRecipes');
});

test('adoption keeps first-run diagnostics in a focused helper', () => {
  const adoptionSource = readFileSync('src/core/adoption.ts', 'utf8');
  const firstRunSource = readFileSync('src/core/adoptionFirstRunDiagnostics.ts', 'utf8');

  expect(adoptionSource).toContain("from './adoptionFirstRunDiagnostics.js'");
  expect(adoptionSource).not.toContain('async function checkPackageJson');
  expect(adoptionSource).not.toContain('async function checkGit');
  expect(firstRunSource).toContain('async function checkPackageJson');
  expect(firstRunSource).toContain('export async function computeFirstRunDiagnostics');
});

test('adoption keeps MCP doctor policy in a focused helper', () => {
  const adoptionSource = readFileSync('src/core/adoption.ts', 'utf8');
  const mcpDoctorSource = readFileSync('src/core/adoptionMcpDoctor.ts', 'utf8');

  expect(adoptionSource).toContain("from './adoptionMcpDoctor.js'");
  expect(adoptionSource).not.toContain('async function checkProjectMcpConfig');
  expect(adoptionSource).not.toContain('function clientConfigCandidates');
  expect(mcpDoctorSource).toContain('export async function computeMcpSetupDoctor');
  expect(mcpDoctorSource).toContain('async function checkProjectMcpConfig');
  expect(mcpDoctorSource).toContain('function clientConfigCandidates');
  expect(mcpDoctorSource).not.toContain("from './adoption.js'");
});
