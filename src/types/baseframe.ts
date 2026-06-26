export type ProjScanAssessmentVerdict = 'proceed' | 'caution' | 'block' | 'unknown';
export type ProjScanAssessmentPriority = 'high' | 'medium' | 'low';
export type ProjScanAssessmentRiskSeverity = 'info' | 'warning' | 'blocking';

export interface ProjScanAssessmentV1 {
  schemaVersion: '1.0';
  kind: 'projscan-assessment';
  producer: {
    name: 'projscan';
    version: string;
  };
  taskId: string;
  intent: string;
  generatedAt: string;
  repository: {
    root: string;
    branch?: string;
    commit?: string;
  };
  verdict: ProjScanAssessmentVerdict;
  summary: string;
  repositoryType?: string;
  impactedAreas: Array<{
    name: string;
    paths: string[];
    reason: string;
  }>;
  reviewFocus: Array<{
    path: string;
    priority: ProjScanAssessmentPriority;
    reasons: string[];
  }>;
  risks: Array<{
    id: string;
    severity: ProjScanAssessmentRiskSeverity;
    category: string;
    message: string;
    files?: string[];
    suggestedAction?: string;
  }>;
  suggestedChecks: Array<{
    command: string;
    reason: string;
    required: boolean;
  }>;
  artifacts?: Array<{
    kind: 'report' | 'scan' | 'log';
    path: string;
  }>;
}

export interface BaseframeAgentWorkflowV1 {
  schemaVersion: '1.0';
  taskId: string;
  intent: string;
  createdAt: string;
  updatedAt: string;
  tools: {
    projscan?: {
      status: 'created' | 'completed' | 'failed';
      assessmentPath: string;
      version: string;
    };
    agentloopkit?: {
      status: 'created' | 'completed' | 'failed';
      taskPath?: string;
      version?: string;
    };
    agentflight?: {
      status: 'created' | 'completed' | 'failed';
      resultPath?: string;
      version?: string;
    };
    [toolName: string]: unknown;
  };
  [field: string]: unknown;
}
