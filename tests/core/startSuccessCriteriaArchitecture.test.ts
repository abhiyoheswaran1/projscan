import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Mission Control success criteria architecture', () => {
  it('keeps fixed route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const fixedCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startFixedRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startFixedRouteCriteria.js'");
    expect(source).not.toContain('const FIXED_ROUTE_CRITERIA');
    expect(fixedCriteria).toContain('export const FIXED_ROUTE_CRITERIA');
    expect(fixedCriteria).toContain('projscan_release_train');
    expect(fixedCriteria).toContain('projscan_workplan');
    expect(fixedCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps file route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const fileCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startFileRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startFileRouteCriteria.js'");
    expect(source).not.toContain('interface FileCriteriaRule');
    expect(source).not.toContain('FILE_CRITERIA_RULES');
    expect(fileCriteria).toContain('export function fileSuccessCriteria');
    expect(fileCriteria).toContain('matchesFileTestDesignCriteria');
    expect(fileCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps understand route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const understandCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startUnderstandRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startUnderstandRouteCriteria.js'");
    expect(source).not.toContain('UNDERSTAND_VIEW_CRITERIA');
    expect(source).not.toContain('contractLocalServiceSetupCriteriaMatches');
    expect(understandCriteria).toContain('export function understandSuccessCriteria');
    expect(understandCriteria).toContain('contractDatabaseSetupCriteriaMatches');
    expect(understandCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps regression route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const regressionCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startRegressionRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startRegressionRouteCriteria.js'");
    expect(source).not.toContain('regressionLevelFromPrimaryAction');
    expect(source).not.toContain('regressionPlanCriterion');
    expect(regressionCriteria).toContain('export function regressionSuccessCriteria');
    expect(regressionCriteria).toContain('regressionLevelFromPrimaryAction');
    expect(regressionCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps dependency route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const dependencyCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startDependencyRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startDependencyRouteCriteria.js'");
    expect(source).not.toContain('DEPENDENCY_LICENSE_KEYWORDS');
    expect(source).not.toContain('bundle-size or dependency-bloat');
    expect(dependencyCriteria).toContain('export function dependencySuccessCriteria');
    expect(dependencyCriteria).toContain('DEPENDENCY_BUNDLE_KEYWORDS');
    expect(dependencyCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps coupling route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const couplingCriteria = await fs.readFile(
      path.join(process.cwd(), 'src/core/startCouplingRouteCriteria.ts'),
      'utf-8',
    );

    expect(source).toContain("from './startCouplingRouteCriteria.js'");
    expect(source).not.toContain('COUPLING_FOLLOW_UP_CRITERION');
    expect(source).not.toContain('Fan-in, fan-out, instability');
    expect(couplingCriteria).toContain('export function couplingSuccessCriteria');
    expect(couplingCriteria).toContain('COUPLING_FOLLOW_UP_CRITERION');
    expect(couplingCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps preflight route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const preflightCriteriaPath = path.join(
      process.cwd(),
      'src/core/startPreflightRouteCriteria.ts',
    );
    const helperExists = await fs
      .access(preflightCriteriaPath)
      .then(() => true)
      .catch(() => false);

    expect(helperExists).toBe(true);
    if (!helperExists) return;

    const preflightCriteria = await fs.readFile(preflightCriteriaPath, 'utf-8');
    expect(source).toContain("from './startPreflightRouteCriteria.js'");
    expect(source).toContain('export { isPreflightAction, preflightModeForMission }');
    expect(source).not.toContain('function preflightSuccessCriteria');
    expect(preflightCriteria).toContain('export function preflightSuccessCriteria');
    expect(preflightCriteria).toContain('export function preflightModeForMission');
    expect(preflightCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps impact route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const impactCriteriaPath = path.join(process.cwd(), 'src/core/startImpactRouteCriteria.ts');
    const helperExists = await fs
      .access(impactCriteriaPath)
      .then(() => true)
      .catch(() => false);

    expect(helperExists).toBe(true);
    if (!helperExists) return;

    const impactCriteria = await fs.readFile(impactCriteriaPath, 'utf-8');
    expect(source).toContain("from './startImpactRouteCriteria.js'");
    expect(source).not.toContain('function impactSuccessCriteria');
    expect(impactCriteria).toContain('export function impactSuccessCriteria');
    expect(impactCriteria).toContain('An exact symbol or file path is selected');
    expect(impactCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps product-planning criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const productPlanningCriteriaPath = path.join(
      process.cwd(),
      'src/core/startProductPlanningRouteCriteria.ts',
    );
    const helperExists = await fs
      .access(productPlanningCriteriaPath)
      .then(() => true)
      .catch(() => false);

    expect(helperExists).toBe(true);
    if (!helperExists) return;

    const productPlanningCriteria = await fs.readFile(productPlanningCriteriaPath, 'utf-8');
    expect(source).toContain("from './startProductPlanningRouteCriteria.js'");
    expect(source).toContain('export { isProductPlanningWorkplanRoute }');
    expect(source).not.toContain('function isProductPlanningWorkplanRoute');
    expect(source).not.toContain('function productPlanningSuccessCriteria');
    expect(productPlanningCriteria).toContain('export function isProductPlanningWorkplanRoute');
    expect(productPlanningCriteria).toContain('export function productPlanningSuccessCriteria');
    expect(productPlanningCriteria).not.toContain('MissionCriteriaContext');
  });

  it('keeps claim route criteria in a focused helper', async () => {
    const source = await fs.readFile(
      path.join(process.cwd(), 'src/core/startSuccessCriteria.ts'),
      'utf-8',
    );
    const claimCriteriaPath = path.join(process.cwd(), 'src/core/startClaimRouteCriteria.ts');
    const helperExists = await fs
      .access(claimCriteriaPath)
      .then(() => true)
      .catch(() => false);

    expect(helperExists).toBe(true);
    if (!helperExists) return;

    const claimCriteria = await fs.readFile(claimCriteriaPath, 'utf-8');
    expect(source).toContain("from './startClaimRouteCriteria.js'");
    expect(source).not.toContain('function claimRouteSuccessCriteria');
    expect(claimCriteria).toContain('export function claimRouteSuccessCriteria');
    expect(claimCriteria).toContain('Active claims are reviewed before a new file');
    expect(claimCriteria).not.toContain('MissionCriteriaContext');
  });
});
