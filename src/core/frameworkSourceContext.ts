export interface FrameworkRequestSourceContext {
  file: string;
  functionName: string;
  memberCallSites: string[];
  memberReferences: string[];
  parameters: string[];
  enabledSources: Set<string>;
  references?: string[];
  contextualCallSite?: string;
  imports?: Array<{ source: string }>;
  directCallSites?: string[];
}

export type FrameworkRequestSourceResolver = (
  context: FrameworkRequestSourceContext,
) => string | null;
