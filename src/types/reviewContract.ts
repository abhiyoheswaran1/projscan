export interface ReviewContractChange {
  kind:
    | 'export-added'
    | 'export-removed'
    | 'export-renamed'
    | 'entrypoint-changed'
    | 'public-export-changed'
    | 'signature-changed';
  file: string;
  symbol?: string;
  before?: string;
  after?: string;
  confidence: 'high' | 'medium' | 'low';
  why: string;
}
