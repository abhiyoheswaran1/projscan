import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('quality scorecard maintainability', () => {
  it('keeps dimension scoring out of the quality scorecard orchestrator', () => {
    const scorecardSource = fs.readFileSync('src/core/qualityScorecard.ts', 'utf8');
    expect(scorecardSource).not.toContain('function buildDimensions');
    expect(scorecardSource).not.toContain('function buildMaintainabilityDimension');
    expect(scorecardSource).not.toContain('function issueDimension');
    expect(scorecardSource).not.toContain('function issueToRisk');
    expect(scorecardSource).not.toContain('function hotspotToRisk');
    expect(scorecardSource).not.toContain('function conflictToRisk');
    expect(scorecardSource).not.toContain('function rankRisks');
    expect(scorecardSource).not.toContain('function baselineRisk');
    expect(scorecardSource).not.toContain('function suggestedActions');
    expect(scorecardSource).not.toContain('function slug');
    expect(scorecardSource).not.toContain("from './startShellArgs.js'");
    expect(scorecardSource).not.toContain('function rankHotspotsForEvidence');
    expect(scorecardSource).not.toContain('function safeHotspots');
    expect(scorecardSource).not.toContain('function safeRiskNow');
    expect(scorecardSource).not.toContain("from './hotspotAnalyzer.js'");
    expect(scorecardSource).not.toContain("from './issueEngine.js'");
    expect(scorecardSource).not.toContain("from './repositoryScanner.js'");
    expect(scorecardSource).not.toContain("from './codeGraph.js'");
    expect(scorecardSource).not.toContain('function isMaintainabilityPenaltyHotspot');
    expect(scorecardSource).not.toContain('function clampScore');
    expect(scorecardSource).toContain("from './qualityScorecardSignals.js'");
    expect(scorecardSource).toContain("from './qualityScorecardDimensions.js'");
    expect(scorecardSource).toMatch(
      /import\s*\{[^}]*baselineQualityScorecardRisk[^}]*qualityScorecardRisks[^}]*suggestQualityScorecardActions[^}]*\}\s*from '\.\/qualityScorecardRisks\.js';/s,
    );

    const signalSource = fs.readFileSync('src/core/qualityScorecardSignals.ts', 'utf8');
    expect(signalSource).toContain('export async function collectQualityScorecardSignals');
    expect(signalSource).toContain('buildRiskNow(rootPath, projectSignals ? { projectSignals } : {})');
    expect(signalSource).not.toContain("from './qualityScorecard.js'");

    const dimensionSource = fs.readFileSync('src/core/qualityScorecardDimensions.ts', 'utf8');
    expect(dimensionSource).toContain('export function buildQualityScorecardDimensions');
    expect(dimensionSource).toContain('export function isMaintainabilityPenaltyHotspot');
    expect(dimensionSource).not.toContain("from './qualityScorecard.js'");

    const riskSource = fs.readFileSync('src/core/qualityScorecardRisks.ts', 'utf8');
    expect(riskSource).toContain('export function qualityScorecardRisks');
    expect(riskSource).toContain('export function baselineQualityScorecardRisk');
    expect(riskSource).toContain('export function suggestQualityScorecardActions');
    expect(riskSource).toContain('isMaintainabilityPenaltyHotspot');
    expect(riskSource).not.toContain("from './qualityScorecard.js'");
  });
});
