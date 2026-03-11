import type { FileEntry, LanguageBreakdown, LanguageStat } from '../types.js';

const EXTENSION_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.pyw': 'Python',
  '.rb': 'Ruby',
  '.go': 'Go',
  '.rs': 'Rust',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.cc': 'C++',
  '.cxx': 'C++',
  '.c': 'C',
  '.h': 'C',
  '.hpp': 'C++',
  '.php': 'PHP',
  '.dart': 'Dart',
  '.scala': 'Scala',
  '.clj': 'Clojure',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.lua': 'Lua',
  '.r': 'R',
  '.R': 'R',
  '.pl': 'Perl',
  '.pm': 'Perl',
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.fish': 'Shell',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'SASS',
  '.less': 'Less',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.sql': 'SQL',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.proto': 'Protocol Buffers',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.md': 'Markdown',
  '.mdx': 'MDX',
  '.txt': 'Text',
};

// Languages excluded from "primary" calculation (config/doc languages)
const EXCLUDED_FROM_PRIMARY = new Set([
  'JSON',
  'YAML',
  'TOML',
  'XML',
  'Markdown',
  'Text',
  'MDX',
]);

export function detectLanguages(files: FileEntry[]): LanguageBreakdown {
  const langCounts = new Map<string, { count: number; extensions: Set<string> }>();
  let totalCounted = 0;

  for (const file of files) {
    const ext = file.extension;
    const lang = EXTENSION_MAP[ext];
    if (!lang) continue;

    totalCounted++;
    const entry = langCounts.get(lang);
    if (entry) {
      entry.count++;
      entry.extensions.add(ext);
    } else {
      langCounts.set(lang, { count: 1, extensions: new Set([ext]) });
    }
  }

  const languages: Record<string, LanguageStat> = {};
  let primaryLang = 'Unknown';
  let primaryCount = 0;

  for (const [lang, data] of langCounts) {
    languages[lang] = {
      name: lang,
      fileCount: data.count,
      percentage: totalCounted > 0 ? Math.round((data.count / totalCounted) * 1000) / 10 : 0,
      extensions: [...data.extensions].sort(),
    };

    if (!EXCLUDED_FROM_PRIMARY.has(lang) && data.count > primaryCount) {
      primaryCount = data.count;
      primaryLang = lang;
    }
  }

  return { primary: primaryLang, languages };
}
