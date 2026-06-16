import { expect, test } from 'vitest';
import type {
  ExportInfo,
  ImportInfo,
  Issue,
  IssueLocation,
  IssueSeverity,
} from '../../src/types/common.js';
import type { AuthorShare, FileHotspot } from '../../src/types/hotspots.js';
import type { FileInspection, FunctionDetail } from '../../src/types/inspection.js';
import type {
  McpPromptArgument,
  McpPromptDefinition,
  McpResourceDefinition,
  McpToolDefinition,
  ToolDeprecation,
} from '../../src/types/mcp.js';
import type {
  AuthorShare as BarrelAuthorShare,
  ExportInfo as BarrelExportInfo,
  FileHotspot as BarrelFileHotspot,
  FileInspection as BarrelFileInspection,
  FunctionDetail as BarrelFunctionDetail,
  ImportInfo as BarrelImportInfo,
  Issue as BarrelIssue,
  IssueLocation as BarrelIssueLocation,
  IssueSeverity as BarrelIssueSeverity,
  McpPromptArgument as BarrelMcpPromptArgument,
  McpPromptDefinition as BarrelMcpPromptDefinition,
  McpResourceDefinition as BarrelMcpResourceDefinition,
  McpToolDefinition as BarrelMcpToolDefinition,
  ToolDeprecation as BarrelToolDeprecation,
} from '../../src/types.js';

const severity: IssueSeverity = 'warning';
const location: IssueLocation = { file: 'src/index.ts', line: 7 };
const issue: Issue = {
  id: 'example-warning',
  title: 'Example warning',
  description: 'Used only to compile-check the public type surface.',
  severity,
  category: 'test',
  fixAvailable: false,
  locations: [location],
};

const importInfo: ImportInfo = {
  source: './types.js',
  specifiers: ['Issue'],
  isRelative: true,
};

const exportInfo: ExportInfo = {
  name: 'Issue',
  type: 'interface',
};

const authorShare: AuthorShare = {
  author: 'agent@example.com',
  commits: 1,
  share: 1,
};

const hotspot: FileHotspot = {
  relativePath: 'src/types.ts',
  churn: 1,
  distinctAuthors: 1,
  daysSinceLastChange: 0,
  lineCount: 1,
  cyclomaticComplexity: 1,
  sizeBytes: 1,
  issueCount: 0,
  issueIds: [],
  riskScore: 1,
  reasons: ['compile check'],
  primaryAuthor: authorShare.author,
  primaryAuthorShare: authorShare.share,
  busFactorOne: true,
  topAuthors: [authorShare],
};

const functionDetail: FunctionDetail = {
  name: 'compileCheck',
  line: 1,
  endLine: 2,
  cyclomaticComplexity: 1,
  fanIn: 0,
};

const fileInspection: FileInspection = {
  relativePath: 'src/types.ts',
  exists: true,
  purpose: 'Type definitions',
  lineCount: 1,
  sizeBytes: 1,
  imports: [importInfo],
  exports: [exportInfo],
  potentialIssues: [],
  hotspot,
  issues: [issue],
  cyclomaticComplexity: 1,
  fanIn: 1,
  fanOut: 0,
  language: 'typescript',
  functions: [functionDetail],
};

const deprecation: ToolDeprecation = {
  since: '3.8.0',
  replacedBy: 'projscan_next',
  note: 'Compile-check deprecation metadata.',
};

const toolDefinition: McpToolDefinition = {
  name: 'projscan_example',
  description: 'Compile-check MCP tool definition.',
  inputSchema: {
    type: 'object',
    properties: {
      root: { type: 'string' },
    },
    required: ['root'],
  },
  deprecated: deprecation,
};

const promptArgument: McpPromptArgument = {
  name: 'root',
  description: 'Repository root.',
  required: true,
};

const promptDefinition: McpPromptDefinition = {
  name: 'example_prompt',
  description: 'Compile-check MCP prompt definition.',
  arguments: [promptArgument],
};

const resourceDefinition: McpResourceDefinition = {
  uri: 'projscan://example',
  name: 'Example',
  description: 'Compile-check MCP resource definition.',
  mimeType: 'application/json',
};

const barrelSeverity: BarrelIssueSeverity = severity;
const barrelLocation: BarrelIssueLocation = location;
const barrelIssue: BarrelIssue = issue;
const barrelImportInfo: BarrelImportInfo = importInfo;
const barrelExportInfo: BarrelExportInfo = exportInfo;
const barrelAuthorShare: BarrelAuthorShare = authorShare;
const barrelHotspot: BarrelFileHotspot = hotspot;
const barrelFunctionDetail: BarrelFunctionDetail = functionDetail;
const barrelFileInspection: BarrelFileInspection = fileInspection;
const barrelDeprecation: BarrelToolDeprecation = deprecation;
const barrelToolDefinition: BarrelMcpToolDefinition = toolDefinition;
const barrelPromptArgument: BarrelMcpPromptArgument = promptArgument;
const barrelPromptDefinition: BarrelMcpPromptDefinition = promptDefinition;
const barrelResourceDefinition: BarrelMcpResourceDefinition = resourceDefinition;

void [
  barrelSeverity,
  barrelLocation,
  barrelIssue,
  barrelImportInfo,
  barrelExportInfo,
  barrelAuthorShare,
  barrelHotspot,
  barrelFunctionDetail,
  barrelFileInspection,
  barrelDeprecation,
  barrelToolDefinition,
  barrelPromptArgument,
  barrelPromptDefinition,
  barrelResourceDefinition,
];

test('shared public type modules compile from modules and legacy barrel', () => {
  expect(barrelResourceDefinition).toBe(resourceDefinition);
});
