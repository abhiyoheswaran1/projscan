import { splitPep508 } from './pythonPep508.js';

export interface PythonListValue {
  name: string;
  versionSpec: string;
  line: number;
}

export function extractListValues(block: string, lineOffset: number): PythonListValue[] {
  const out: PythonListValue[] = [];
  const lines = block.split('\n');
  for (let index = 0; index < lines.length; index++) {
    const stripped = lines[index].replace(/#.*$/, '').trim();
    const match = /^["']([^"']+)["']/.exec(stripped);
    if (!match) continue;
    const { name, versionSpec } = splitPep508(match[1]);
    if (!name) continue;
    out.push({ name, versionSpec, line: lineOffset + index });
  }
  return out;
}

export function offsetToLine(content: string, offset: number): number {
  let line = 0;
  for (let index = 0; index < offset && index < content.length; index++) {
    if (content[index] === '\n') line++;
  }
  return line + 1;
}
