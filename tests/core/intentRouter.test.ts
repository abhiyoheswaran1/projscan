import { describe, expect, it } from 'vitest';
import { routeIntent, ROUTE_CATALOG } from '../../src/core/intentRouter.js';

describe('routeIntent', () => {
  it('routes explicit issue-fix intents to fix-suggest instead of bug hunt', () => {
    const result = routeIntent('fix issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_fix_suggest',
        confidence: 'high',
        score: 2,
        matchedKeywords: ['fix', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.25,
        matchedKeywords: ['fix'],
      }),
    );
  });

  it('routes explicit issue-explanation intents to explain-issue before fix-suggest', () => {
    const result = routeIntent('explain issue missing-test-framework');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_explain_issue',
        confidence: 'high',
        score: 3,
        matchedKeywords: ['explain', 'issue'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_fix_suggest')).toEqual(
      expect.objectContaining({
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['issue'],
      }),
    );
  });

  it('keeps generic PR/template lookup intents on search instead of bug hunt', () => {
    const result = routeIntent('find the PR template');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_search',
        confidence: 'medium',
        score: 1,
        matchedKeywords: ['find'],
      }),
    );
    expect(result.matches.find((match) => match.tool === 'projscan_bug_hunt')).toEqual(
      expect.objectContaining({
        confidence: 'low',
        score: 0.5,
        matchedKeywords: ['find', 'pr'],
      }),
    );
  });

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

  it('routes coverage gap questions to scariest-untested-files analysis', () => {
    const result = routeIntent('what are the scariest untested files');

    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Tests',
        tool: 'projscan_coverage',
        cli: 'projscan coverage',
        confidence: 'high',
        score: 4,
        matchedKeywords: ['scariest', 'untested'],
      }),
    );

    const noTests = routeIntent('which files have no tests');
    expect(noTests.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coverage',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['files', 'no', 'tests']),
      }),
    );
    expect(
      noTests.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();
  });

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

  it('routes PII and GDPR data-handling questions to dataflow hardening', () => {
    const pii = routeIntent('where is PII handled');

    expect(pii.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Security',
        tool: 'projscan_dataflow',
        cli: 'projscan dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['pii', 'handled']),
      }),
    );

    const leak = routeIntent('does this endpoint leak PII');
    expect(leak.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['leak', 'pii']),
      }),
    );

    const gdpr = routeIntent('GDPR compliance check');
    expect(gdpr.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['gdpr', 'compliance']),
      }),
    );
    expect(gdpr.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tokens = routeIntent('where do we store access tokens');
    expect(tokens.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dataflow',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['store', 'tokens']),
      }),
    );
  });

  it('routes tiny safe task prompts to bug-hunt prioritization', () => {
    const fiveMinutes = routeIntent('what can I do in five minutes');

    expect(fiveMinutes.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Agent planning',
        tool: 'projscan_bug_hunt',
        cli: 'projscan bug-hunt',
        confidence: 'high',
        matchedKeywords: ['five', 'minutes'],
      }),
    );

    const easy = routeIntent('pick an easy task for me');
    expect(easy.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['easy', 'task']),
      }),
    );

    const intern = routeIntent('what should an intern work on');
    expect(intern.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_bug_hunt',
        confidence: 'high',
        matchedKeywords: ['intern'],
      }),
    );
  });

  it('routes tech-debt simplification away from incident down wording', () => {
    const techDebt = routeIntent('what tech debt should I pay down');

    expect(techDebt.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Hotspots',
        tool: 'projscan_hotspots',
        cli: 'projscan hotspots',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['tech', 'debt']),
      }),
    );
    expect(
      techDebt.matches.find((match) => match.tool === 'projscan_regression_plan'),
    ).toBeUndefined();

    const simplify = routeIntent('what code should I simplify');
    expect(simplify.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_hotspots',
        confidence: 'high',
        matchedKeywords: ['simplify'],
      }),
    );
  });

  it('routes local setup environment and connection failures to the right workflows', () => {
    const localServices = routeIntent('how do I start local services');
    expect(localServices.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['start', 'local', 'services']),
      }),
    );
    expect(
      localServices.matches.find((match) => match.tool === 'projscan_hotspots'),
    ).toBeUndefined();

    const dockerCommand = routeIntent('what command starts docker compose');
    expect(dockerCommand.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['command', 'docker', 'compose']),
      }),
    );

    const envMissing = routeIntent('environment variables missing');

    expect(envMissing.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Understand',
        tool: 'projscan_understand',
        cli: 'projscan understand',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['environment', 'variables', 'missing']),
      }),
    );

    const dbRefused = routeIntent('database connection refused locally');
    expect(dbRefused.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['connection', 'refused']),
      }),
    );
    expect(dbRefused.matches.find((match) => match.tool === 'projscan_impact')).toBeUndefined();

    const portInUse = routeIntent('port 3000 already in use');
    expect(portInUse.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Regression',
        tool: 'projscan_regression_plan',
        cli: 'projscan regression-plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['port']),
      }),
    );

    const eaddrinuse = routeIntent('EADDRINUSE on startup');
    expect(eaddrinuse.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['eaddrinuse']),
      }),
    );

    const permissionDenied = routeIntent('permission denied when running dev server');
    expect(permissionDenied.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['permission', 'denied']),
      }),
    );

    const peerConflict = routeIntent('peer dependency conflict after npm install');
    expect(peerConflict.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['peer', 'install']),
      }),
    );
    expect(peerConflict.matches.find((match) => match.tool === 'projscan_dependencies')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['dependency'],
      }),
    );

    const enoent = routeIntent('ENOENT package.json missing');
    expect(enoent.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_regression_plan',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['enoent']),
      }),
    );
    expect(enoent.matches.find((match) => match.tool === 'projscan_upgrade')).toBeUndefined();
  });

  it('routes bundle-size and package-bloat questions to dependency inventory', () => {
    const bundle = routeIntent('why is the bundle so large');
    expect(bundle.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Dependencies',
        tool: 'projscan_dependencies',
        cli: 'projscan dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'large']),
      }),
    );
    expect(bundle.matches.find((match) => match.tool === 'projscan_explain_issue')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['why'],
      }),
    );

    const reduce = routeIntent('reduce bundle size');
    expect(reduce.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['bundle', 'size']),
      }),
    );

    const bloat = routeIntent('find package bloat');
    expect(bloat.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_dependencies',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['package', 'bloat']),
      }),
    );
    expect(bloat.matches.find((match) => match.tool === 'projscan_upgrade')).toEqual(
      expect.objectContaining({
        matchedKeywords: ['package'],
      }),
    );
  });

  it('routes circular dependency and tight-coupling questions to coupling analysis', () => {
    const circular = routeIntent('show circular dependencies');
    expect(circular.matches[0]).toEqual(
      expect.objectContaining({
        category: 'Architecture',
        tool: 'projscan_coupling',
        cli: 'projscan coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['circular', 'dependencies']),
      }),
    );
    expect(
      circular.matches.find((match) => match.tool === 'projscan_dependencies'),
    ).toBeUndefined();

    const cycles = routeIntent('find dependency cycles');
    expect(cycles.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['dependency', 'cycles']),
      }),
    );
    expect(cycles.matches.find((match) => match.tool === 'projscan_dependencies')).toBeUndefined();

    const tight = routeIntent('what modules are tightly coupled');
    expect(tight.matches[0]).toEqual(
      expect.objectContaining({
        tool: 'projscan_coupling',
        confidence: 'high',
        matchedKeywords: expect.arrayContaining(['modules', 'coupled']),
      }),
    );
  });

  it('returns the full grouped catalog when no intent is given', () => {
    const result = routeIntent(undefined);
    expect(result.intent).toBeNull();
    expect(result.matches.length).toBe(ROUTE_CATALOG.length);
    expect(result.matches[0]).toEqual(
      expect.objectContaining({
        confidence: 'low',
        rank: 1,
        score: 0,
        matchedKeywords: [],
      }),
    );
    // grouped by category, every catalog entry present
    const tools = new Set(result.matches.map((m) => m.tool));
    expect(tools.has('projscan_understand')).toBe(true);
    expect(tools.has('projscan_collision')).toBe(true);
  });

  it('reports no match for an unrelated intent', () => {
    const result = routeIntent('brew a cup of tea');
    expect(result.matches).toEqual([]);
    expect(result.matched).toBe(false);
  });

  it('every catalog entry names a real tool and a runnable example', () => {
    for (const entry of ROUTE_CATALOG) {
      expect(entry.tool).toMatch(/^projscan_/);
      expect(entry.cli).toMatch(/^projscan /);
      expect(entry.example.length).toBeGreaterThan(0);
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
  });
});
