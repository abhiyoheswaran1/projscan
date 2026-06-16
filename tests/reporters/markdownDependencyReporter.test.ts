import { describe, expect, it } from 'vitest';
import { reportDependenciesMarkdown } from '../../src/reporters/markdownDependencyReporter.js';
import { reportDependenciesMarkdown as reportDependenciesMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { DependencyReport } from '../../src/types.js';
import { captureStdout, makeDependencyReport } from './fixtures.js';

describe('markdownDependencyReporter', () => {
  it('renders totals, license summary, installed sizes, and risks', async () => {
    const out = await captureStdout(() => reportDependenciesMarkdown(makeDependencyReport()));

    expect(out).toContain('# Dependency Report');
    expect(out).toContain('- Production: **2** packages');
    expect(out).toContain('- Development: **1** packages');
    expect(out).toContain('## License Summary');
    expect(out).toContain('- Known: **3**');
    expect(out).toContain('- Unknown: **0**');
    expect(out).toContain('- Copyleft: **0**');
    expect(out).toContain('- MIT: 3');
    expect(out).toContain('## Installed Package Sizes');
    expect(out).toContain('- Total: **1.3 MB**');
    expect(out).toContain('- Missing: **1**');
    expect(out).toContain('- `lodash` ^4.0.0: 1.2 MB (production)');
    expect(out).toContain('## Risks');
    expect(out).toContain('- **lodash**: heavy package (medium)');
  });

  it('omits optional sections when optional dependency evidence is absent', async () => {
    const report: DependencyReport = {
      totalDependencies: 0,
      totalDevDependencies: 0,
      dependencies: {},
      devDependencies: {},
      risks: [],
    };

    const out = await captureStdout(() => reportDependenciesMarkdown(report));

    expect(out).toContain('# Dependency Report');
    expect(out).toContain('- Production: **0** packages');
    expect(out).toContain('- Development: **0** packages');
    expect(out).not.toContain('## License Summary');
    expect(out).not.toContain('## Installed Package Sizes');
    expect(out).not.toContain('## Risks');
  });

  it('preserves the markdownReporter re-export for existing callers', async () => {
    const out = await captureStdout(() =>
      reportDependenciesMarkdownFromMarkdownReporter(makeDependencyReport()),
    );

    expect(out).toContain('# Dependency Report');
    expect(out).toContain('- MIT: 3');
    expect(out).toContain('- **lodash**: heavy package (medium)');
  });
});
