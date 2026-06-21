import { describe, expect, it } from 'vitest';
import { dependencyKeywordWeight } from '../../src/core/intentRouterDependencyKeywordWeights.js';
import { keywordWeight } from '../../src/core/intentRouterKeywordWeights.js';

describe('dependencyKeywordWeight', () => {
  it('keeps dependency, workspace, upgrade, and audit weights aligned with the router', () => {
    const cases: Array<[string, string, number]> = [
      ['projscan_dependencies', 'dependencies', 2],
      ['projscan_dependencies', 'bundle', 2],
      ['projscan_dependencies', 'license', 2],
      ['projscan_workspaces', 'workspace', 2],
      ['projscan_workspaces', 'owns', 2],
      ['projscan_upgrade', 'upgrade', 2],
      ['projscan_upgrade', 'remove', 2],
      ['projscan_audit', 'cve', 2],
      ['projscan_audit', 'security', 2],
      ['projscan_audit', 'package', 1],
    ];

    for (const [tool, keyword, weight] of cases) {
      expect(dependencyKeywordWeight(tool, keyword)).toBe(weight);
      expect(keywordWeight({ tool }, keyword)).toBe(weight);
    }
  });

  it('leaves unrelated dependency keywords to the main router fallback', () => {
    expect(dependencyKeywordWeight('projscan_dependencies', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_dependencies' }, 'review')).toBe(1);
    expect(dependencyKeywordWeight('projscan_workspaces', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_workspaces' }, 'review')).toBe(1);
    expect(dependencyKeywordWeight('projscan_upgrade', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_upgrade' }, 'review')).toBe(1);
    expect(dependencyKeywordWeight('projscan_audit', 'review')).toBeUndefined();
    expect(keywordWeight({ tool: 'projscan_audit' }, 'review')).toBe(1);
  });
});
