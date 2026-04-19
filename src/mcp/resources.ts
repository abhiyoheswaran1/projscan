import type { McpResourceDefinition } from '../types.js';
import { scanRepository } from '../core/repositoryScanner.js';
import { collectIssues } from '../core/issueEngine.js';
import { analyzeHotspots } from '../core/hotspotAnalyzer.js';
import { calculateScore } from '../utils/scoreCalculator.js';

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

const resourceDefinitions: McpResourceDefinition[] = [
  {
    uri: 'projscan://health',
    name: 'Project Health Report',
    description: 'Live projscan doctor output: score, grade, and open issues.',
    mimeType: 'application/json',
  },
  {
    uri: 'projscan://hotspots',
    name: 'Risk Hotspots',
    description:
      'Files ranked by git-churn × complexity × open issues × recency. Includes ownership data.',
    mimeType: 'application/json',
  },
  {
    uri: 'projscan://structure',
    name: 'Project Directory Tree',
    description: 'File/directory layout of the project with counts.',
    mimeType: 'application/json',
  },
];

export function getResourceDefinitions(): McpResourceDefinition[] {
  return resourceDefinitions;
}

export async function readResource(uri: string, rootPath: string): Promise<McpResourceContent> {
  switch (uri) {
    case 'projscan://health': {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const health = calculateScore(issues);
      return jsonResource(uri, { health, issues });
    }
    case 'projscan://hotspots': {
      const scan = await scanRepository(rootPath);
      const issues = await collectIssues(rootPath, scan.files);
      const hotspots = await analyzeHotspots(rootPath, scan.files, issues, { limit: 20 });
      return jsonResource(uri, hotspots);
    }
    case 'projscan://structure': {
      const scan = await scanRepository(rootPath);
      return jsonResource(uri, { structure: scan.directoryTree, totalFiles: scan.totalFiles });
    }
    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }
}

function jsonResource(uri: string, data: unknown): McpResourceContent {
  return {
    uri,
    mimeType: 'application/json',
    text: JSON.stringify(data, null, 2),
  };
}
