import fs from 'node:fs/promises';
import path from 'node:path';
import type { Fix } from '../types.js';

export const editorconfigFix: Fix = {
  id: 'add-editorconfig',
  title: 'Add .editorconfig',
  description: 'Creates a standard .editorconfig file for consistent editor settings',
  issueId: 'missing-editorconfig',

  async apply(rootPath: string): Promise<void> {
    const content = `root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
`;

    await fs.writeFile(path.join(rootPath, '.editorconfig'), content, 'utf-8');
  },
};
