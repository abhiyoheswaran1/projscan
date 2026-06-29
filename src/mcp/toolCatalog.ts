import { analyzeTool } from './tools/analyze.js';
import { doctorTool } from './tools/doctor.js';
import { hotspotsTool } from './tools/hotspots.js';
import { fileTool } from './tools/file.js';
import { structureTool } from './tools/structure.js';
import { dependenciesTool } from './tools/dependencies.js';
import { outdatedTool } from './tools/outdated.js';
import { auditTool } from './tools/audit.js';
import { upgradeTool } from './tools/upgrade.js';
import { coverageTool } from './tools/coverage.js';
import { semanticGraphTool } from './tools/semanticGraph.js';
import { couplingTool } from './tools/coupling.js';
import { workspacesTool } from './tools/workspaces.js';
import { prDiffTool } from './tools/prDiff.js';
import { reviewTool } from './tools/review.js';
import { fixSuggestTool } from './tools/fixSuggest.js';
import { explainIssueTool } from './tools/explainIssue.js';
import { impactTool } from './tools/impact.js';
import { collisionTool } from './tools/collision.js';
import { claimTool } from './tools/claim.js';
import { mergeRiskTool } from './tools/mergeRisk.js';
import { routeTool } from './tools/route.js';
import { coordinateTool } from './tools/coordinate.js';
import { coordinateWatchTool } from './tools/coordinateWatch.js';
import { searchTool } from './tools/search.js';
import { sessionTool } from './tools/session.js';
import { memoryTool } from './tools/memory.js';
import { workspaceGraphTool } from './tools/workspaceGraph.js';
import { applyFixTool } from './tools/applyFix.js';
import { taintTool } from './tools/taint.js';
import { dataflowTool } from './tools/dataflow.js';
import { costSummaryTool } from './tools/costSummary.js';
import { reviewWatchTool } from './tools/reviewWatch.js';
import { pluginTool } from './tools/plugin.js';
import { preflightTool } from './tools/preflight.js';
import { workplanTool } from './tools/workplan.js';
import { releaseTrainTool } from './tools/releaseTrain.js';
import { bugHuntTool } from './tools/bugHunt.js';
import { evidencePackTool } from './tools/evidencePack.js';
import { regressionPlanTool } from './tools/regressionPlan.js';
import { agentBriefTool } from './tools/agentBrief.js';
import { qualityScorecardTool } from './tools/qualityScorecard.js';
import { assessTool } from './tools/assess.js';
import { simulateTool } from './tools/simulate.js';
import { proveTool } from './tools/prove.js';
import { passportTool } from './tools/passport.js';
import { proofBrokerTool } from './tools/proofBroker.js';
import { reviewGateTool } from './tools/reviewGate.js';
import { adoptionTool } from './tools/adoption.js';
import { startTool } from './tools/start.js';
import { understandTool } from './tools/understand.js';
import type { McpTool } from './tools/_shared.js';

export const mcpTools: McpTool[] = [
  analyzeTool,
  doctorTool,
  hotspotsTool,
  fileTool,
  structureTool,
  dependenciesTool,
  outdatedTool,
  auditTool,
  upgradeTool,
  coverageTool,
  semanticGraphTool,
  couplingTool,
  workspacesTool,
  prDiffTool,
  reviewTool,
  fixSuggestTool,
  explainIssueTool,
  impactTool,
  searchTool,
  sessionTool,
  memoryTool,
  workspaceGraphTool,
  applyFixTool,
  taintTool,
  dataflowTool,
  costSummaryTool,
  reviewWatchTool,
  pluginTool,
  preflightTool,
  workplanTool,
  releaseTrainTool,
  bugHuntTool,
  evidencePackTool,
  regressionPlanTool,
  agentBriefTool,
  qualityScorecardTool,
  assessTool,
  simulateTool,
  proveTool,
  passportTool,
  proofBrokerTool,
  reviewGateTool,
  adoptionTool,
  startTool,
  understandTool,
  collisionTool,
  claimTool,
  mergeRiskTool,
  routeTool,
  coordinateTool,
  coordinateWatchTool,
];
