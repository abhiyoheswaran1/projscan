import { scanRepository } from '../../core/repositoryScanner.js';
import { buildCodeGraph } from '../../core/codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from '../../core/indexCache.js';
import {
  buildSearchIndex,
  search as searchIndex,
  attachExcerpts,
  expandQuery,
} from '../../core/searchIndex.js';
import {
  buildSemanticIndex,
  semanticSearch,
  reciprocalRankFusion,
} from '../../core/semanticSearch.js';
import { isSemanticAvailable } from '../../core/embeddings.js';
import { paginate, listChecksum, readPageParams } from '../pagination.js';
import { PACKAGE_ARG_SCHEMA, resolvePackageFilter, type McpTool } from './_shared.js';

export const searchTool: McpTool = {
  name: 'projscan_search',
  description:
    'Ranked search across the project. Lexical (BM25) by default; optional semantic (vector) and hybrid (RRF fusion) modes available when the @xenova/transformers peer dependency is installed. Scope controls what to search: "auto"/"content" (ranked content matches with excerpts), "symbols" (exported names), "files" (path substring).',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search string. Multi-word queries are treated as OR across BM25 terms; semantic mode embeds the full query.',
      },
      scope: {
        type: 'string',
        description: 'What to search over: "auto" (= content), "symbols", "files", "content".',
        enum: ['auto', 'symbols', 'files', 'content'],
      },
      mode: {
        type: 'string',
        description:
          '"lexical" (default, BM25) | "semantic" (embeddings, requires peer dep) | "hybrid" (BM25 + semantic via reciprocal rank fusion). Ignored for "symbols" and "files" scopes.',
        enum: ['lexical', 'semantic', 'hybrid'],
      },
      limit: { type: 'number', description: 'Max matches returned (default 30).' },
      max_tokens: { type: 'number', description: 'Cap the response to roughly this many tokens.' },
      package: PACKAGE_ARG_SCHEMA,
    },
    required: ['query'],
  },
  handler: async (args, rootPath) => {
    const query = String(args.query ?? '').trim();
    if (!query) throw new Error('query argument is required and must be non-empty');
    const scope = String(args.scope ?? 'auto');
    const limit = Math.max(1, Math.min(500, typeof args.limit === 'number' ? args.limit : 30));

    const scan = await scanRepository(rootPath);
    const cached = await loadCachedGraph(rootPath);
    const graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph);
    const passes = await resolvePackageFilter(rootPath, args);

    if (scope === 'files') {
      const q = query.toLowerCase();
      const all = scan.files
        .filter((f) => f.relativePath.toLowerCase().includes(q))
        .filter((f) => !passes || passes(f.relativePath))
        .map((f) => ({ file: f.relativePath, sizeBytes: f.sizeBytes }));
      const page = paginate(all, readPageParams(args), listChecksum(all));
      return { scope, query, matches: page.items, total: page.total, nextCursor: page.nextCursor };
    }

    if (scope === 'symbols') {
      const q = query.toLowerCase();
      const rawMatches: Array<{ symbol: string; kind: string; file: string; line: number; rank: number }> = [];
      for (const [file, entry] of graph.files) {
        if (passes && !passes(file)) continue;
        for (const exp of entry.exports) {
          const name = exp.name.toLowerCase();
          if (!name.includes(q)) continue;
          const rank = name === q ? 0 : name.startsWith(q) ? 1 : 2;
          rawMatches.push({ symbol: exp.name, kind: exp.kind, file, line: exp.line, rank });
        }
      }
      rawMatches.sort((a, b) => a.rank - b.rank);
      const cleaned = rawMatches.map((m) => ({
        symbol: m.symbol,
        kind: m.kind,
        file: m.file,
        line: m.line,
      }));
      const page = paginate(cleaned, readPageParams(args), listChecksum(cleaned));
      return { scope, query, matches: page.items, total: page.total, nextCursor: page.nextCursor };
    }

    const mode = String(args.mode ?? 'lexical');
    const index = await buildSearchIndex(rootPath, scan.files, graph);
    const lexicalHitsAll = searchIndex(index, query, { limit });
    const lexicalHits = passes ? lexicalHitsAll.filter((h) => passes(h.file)) : lexicalHitsAll;
    const tokens = expandQuery(query);

    if (mode === 'lexical') {
      const withExcerpts = await attachExcerpts(rootPath, lexicalHits, tokens);
      const page = paginate(withExcerpts, readPageParams(args), listChecksum(withExcerpts));
      return {
        scope: scope === 'auto' ? 'content' : scope,
        mode: 'lexical',
        query,
        queryTokens: tokens,
        matches: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
    }

    const hasSemantic = await isSemanticAvailable();
    if (!hasSemantic) {
      return {
        scope: scope === 'auto' ? 'content' : scope,
        mode,
        query,
        error:
          'Semantic search requires the optional peer dependency @xenova/transformers. Install it with: npm install @xenova/transformers',
        available: false,
        matches: [],
        total: 0,
      };
    }

    const semIndex = await buildSemanticIndex(rootPath, scan.files);
    if (!semIndex) {
      return {
        scope: scope === 'auto' ? 'content' : scope,
        mode,
        query,
        error: 'Semantic index build failed (peer loaded but model not usable).',
        available: false,
        matches: [],
        total: 0,
      };
    }

    const semHitsAll = await semanticSearch(semIndex, query, { limit });
    const semHits = passes ? semHitsAll.filter((h) => passes(h.file)) : semHitsAll;

    if (mode === 'semantic') {
      const enriched = await attachExcerpts(
        rootPath,
        semHits.map((h) => ({
          file: h.file,
          score: h.score,
          matched: [],
          symbolMatch: false,
          pathMatch: false,
          excerpt: '',
          line: 0,
        })),
        tokens,
      );
      const page = paginate(enriched, readPageParams(args), listChecksum(enriched));
      return {
        scope: scope === 'auto' ? 'content' : scope,
        mode: 'semantic',
        query,
        model: semIndex.model,
        matches: page.items,
        total: page.total,
        nextCursor: page.nextCursor,
      };
    }

    const fused = reciprocalRankFusion([lexicalHits, semHits]).slice(0, limit);
    const enriched = await attachExcerpts(
      rootPath,
      fused.map((f) => ({
        file: f.file,
        score: f.score,
        matched: [],
        symbolMatch: false,
        pathMatch: false,
        excerpt: '',
        line: 0,
      })),
      tokens,
    );
    const page = paginate(enriched, readPageParams(args), listChecksum(enriched));
    return {
      scope: scope === 'auto' ? 'content' : scope,
      mode: 'hybrid',
      query,
      queryTokens: tokens,
      model: semIndex.model,
      matches: page.items,
      total: page.total,
      nextCursor: page.nextCursor,
    };
  },
};
