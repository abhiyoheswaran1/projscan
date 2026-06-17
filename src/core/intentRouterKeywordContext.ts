export interface KeywordMatchRouteEntry {
  tool: string;
}

export interface KeywordMatchContext {
  entry: KeywordMatchRouteEntry;
  keyword: string;
  tokens: Set<string>;
  hasFilePath: boolean;
  hasPackageRemoval: boolean;
  hasPackageChange: boolean;
  hasEnvVar: boolean;
  hasQuotedText: boolean;
}
