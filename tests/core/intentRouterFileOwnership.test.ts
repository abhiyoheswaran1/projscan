import { describe, expect, it } from 'vitest';
import { routeIntent } from '../../src/core/intentRouter.js';

describe('routeIntent file ownership routing', () => {
  it('routes file explanation intents to file inspection', () => {
    const result = routeIntent('explain src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['explain'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_start')).toBeUndefined();
  });

  it('routes exact-file risk questions to file inspection without hijacking broad risk questions', () => {
    const risky = routeIntent('why is src/core/start.ts risky?');

    expect(risky.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );
    expect(risky.matches.find((match) => match.tool === 'projscan_quality_scorecard')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['risky'],
      }),
    );

    const risks = routeIntent('what risks are in src/core/start.ts?');
    expect(risks.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['risks'],
      }),
    );

    expect(routeIntent('what is risky in this repo?').matches[0].tool).toBe(
      'projscan_quality_scorecard',
    );
    expect(routeIntent('what files are risky to touch?').matches[0].tool).toBe('projscan_hotspots');
  });

  it('routes file ownership questions to file inspection instead of claims', () => {
    const result = routeIntent('who owns src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['owns'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();
  });

  it('routes area ownership lookup to search instead of advisory claims', () => {
    const auth = routeIntent('who owns auth');
    expect(auth.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Search',
        tool: 'projscan_search',
        cli: 'projscan search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['owns']),
      }),
    );
    expect(auth.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const team = routeIntent('which team owns payments');
    expect(team.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['team', 'owns']),
      }),
    );

    const area = routeIntent('who owns this area');
    expect(area.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['owns', 'area']),
      }),
    );

    const ask = routeIntent('who should I ask about auth');
    expect(ask.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['ask']),
      }),
    );
    expect(ask.matches.find((match) => match.tool === 'projscan_claim')).toBeUndefined();

    const help = routeIntent('who can help with payments');
    expect(help.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['help']),
      }),
    );

    const expert = routeIntent('find expert for billing');
    expect(expert.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['find', 'expert']),
      }),
    );
  });

  it('routes file authorship and history questions to file inspection instead of session history', () => {
    const touched = routeIntent('who last touched src/core/start.ts?');

    expect(touched.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['last', 'touched'],
      }),
    );
    expect(touched.matches.find((match) => match.tool === 'projscan_session')).toEqual(
      expect.objectContaining({
        confidence: 'high',
        matchedKeywords: ['touched', 'last'],
      }),
    );

    const changed = routeIntent('who changed src/core/start.ts recently');
    expect(changed.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_file',
        cli: 'projscan file',
        confidence: 'high',
        matchedKeywords: ['changed', 'recently'],
      }),
    );
  });

  it('routes explicit file claim requests to advisory claims before path keywords', () => {
    const result = routeIntent('claim src/core/start.ts for me');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['claim'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_hotspots')).toBeUndefined();
  });

  it('routes claim requests with explicit agent names to advisory claims', () => {
    const result = routeIntent('claim src/core/start.ts as agent-alpha');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['claim'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_coordinate')).toBeUndefined();
  });

  it('routes active-claims questions to advisory claim listing', () => {
    const result = routeIntent('show active claims');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Swarm coordination',
        tool: 'projscan_claim',
        cli: 'projscan claim',
        confidence: 'high',
        score: 2.5,
        matchedKeywords: ['claims', 'active'],
      }),
    );
  });

  it('routes file importer questions to targeted semantic graph queries', () => {
    const result = routeIntent('who imports src/core/start.ts');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_semantic_graph',
        cli: 'projscan semantic-graph',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['imports'],
      }),
    );

    const packageImport = routeIntent('which files import package chalk');
    expect(packageImport.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['import']),
      }),
    );
    expect(
      packageImport.matches.find((match) => match.tool === 'projscan_upgrade'),
    ).toBeUndefined();

    const packageWho = routeIntent('who imports package chalk');
    expect(packageWho.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['imports']),
      }),
    );

    const packageUse = routeIntent('who uses lodash');
    expect(packageUse.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['uses']),
      }),
    );

    const dependencyWhy = routeIntent('why do we depend on lodash');
    expect(dependencyWhy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['depend']),
      }),
    );

    const installed = routeIntent('why is lodash installed');
    expect(installed.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_semantic_graph',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['installed']),
      }),
    );

    const fileDependency = routeIntent('what depends on src/core/start.ts');
    expect(fileDependency.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_impact',
        confidence: 'high',
        matchedKeywords: ['depends'],
      }),
    );
  });
});
