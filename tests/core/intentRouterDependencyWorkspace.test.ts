import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent dependency and workspace routing', () => {
  it('routes package bump questions to upgrade preview before generic impact', () => {
    const result = routeIntent('what breaks if I bump chalk to 6');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['bump'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['breaks'],
      }),
    );
  });

  it('routes package update questions to upgrade preview before generic impact', () => {
    const result = routeIntent('what breaks if I update react');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        matchedKeywords: ['update'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['breaks'],
      }),
    );
  });

  it('routes rollback and revert questions to impact analysis', () => {
    const revert = routeIntent('how do I revert this change safely');
    expect(revert.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        matchedKeywords: ['revert'],
      }),
    );

    const backOut = routeIntent('back out this change');
    expect(backOut.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['back', 'out'],
      }),
    );

    const undo = routeIntent('can I undo this change');
    expect(undo.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['undo'],
      }),
    );

    const rollback = routeIntent('what is the safest rollback plan');
    expect(rollback.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['rollback'],
      }),
    );
    expect(rollback.matches.find((match) => match.tool === 'projscan_merge_risk')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['safest'],
      }),
    );
  });

  it('routes schema and column rollback questions to impact analysis', () => {
    const schema = routeIntent('what breaks if I change the schema');
    expect(schema.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Impact',
        tool: 'projscan_impact',
        cli: 'projscan impact',
        confidence: 'high',
        matchedKeywords: ['breaks', 'schema'],
      }),
    );

    const column = routeIntent('can I drop this column');
    expect(column.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['drop', 'column'],
      }),
    );
    expect(column.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();
  });

  it('routes package removal questions to upgrade preview impact', () => {
    const result = routeIntent('can I remove lodash');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['remove'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();
  });

  it('routes reversed package-removal wording to upgrade preview impact', () => {
    const result = routeIntent('is lodash safe to remove');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_upgrade',
        cli: 'projscan upgrade',
        confidence: 'high',
        matchedKeywords: ['remove'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_doctor')).toBeUndefined();
  });

  it('routes dependency vulnerability and CVE questions to audit', () => {
    const packageCve = routeIntent('does lodash have a CVE');
    expect(packageCve.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_audit',
        cli: 'projscan audit',
        confidence: 'high',
        matchedKeywords: ['cve'],
      }),
    );

    const repoCves = routeIntent('what CVEs affect this repo');
    expect(repoCves.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['cves'],
      }),
    );
    expect(repoCves.matches.find((match) => match.tool === 'projscan_impact')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['affect'],
      }),
    );

    const auditSecurity = routeIntent('audit package security');
    expect(auditSecurity.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['audit', 'security', 'package'],
      }),
    );

    const vulnerablePackages = routeIntent('find vulnerable packages');
    expect(vulnerablePackages.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_audit',
        confidence: 'high',
        matchedKeywords: ['vulnerable', 'packages'],
      }),
    );
    expect(
      vulnerablePackages.matches.find((match) => match.tool === 'projscan_dependencies'),
    ).toEqual(
      expect.objectContaining({
        matchedKeywords: ['packages'],
      }),
    );
  });

  it('routes monorepo workspace map questions to workspaces', () => {
    const workspaces = routeIntent('what workspaces are in this repo');
    expect(workspaces.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_workspaces',
        cli: 'projscan workspaces',
        confidence: 'high',
        matchedKeywords: ['workspaces'],
      }),
    );

    const packages = routeIntent('list monorepo packages');
    expect(packages.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'packages', 'list'],
      }),
    );

    const map = routeIntent('monorepo package map');
    expect(map.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'package', 'map'],
      }),
    );
    expect(map.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['package'],
      }),
    );
  });

  it('routes workspace ownership and placement questions to workspaces', () => {
    const owner = routeIntent('which workspace owns auth');
    expect(owner.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_workspaces',
        cli: 'projscan workspaces',
        confidence: 'high',
        matchedKeywords: ['workspace', 'owns'],
      }),
    );
    expect(owner.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const contains = routeIntent('what package contains auth');
    expect(contains.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['package', 'contains'],
      }),
    );

    const placement = routeIntent('where should I put this in the monorepo');
    expect(placement.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_workspaces',
        confidence: 'high',
        matchedKeywords: ['monorepo', 'put'],
      }),
    );
  });

  it('routes dependency inventory questions to dependency analysis before upgrade checks', () => {
    const result = routeIntent('what dependencies does this repo use');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['dependencies'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        matchedKeywords: ['dependencies'],
      }),
    );
  });

  it('routes dependency license and open-source compliance questions to dependency inventory', () => {
    const notices = routeIntent('third party notices');

    expect(notices.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        matchedKeywords: ['third', 'party', 'notices'],
      }),
    );

    const compliance = routeIntent('open source compliance check');
    expect(compliance.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['open', 'source', 'compliance']),
      }),
    );
  });
});
