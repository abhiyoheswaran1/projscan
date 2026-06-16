import fs from 'node:fs/promises';

export async function countLines(absolutePath: string): Promise<number | null> {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    if (!content) return 0;
    let lines = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
    }
    return lines;
  } catch {
    return null;
  }
}

export function lineCountOrEstimate(lineCount: number | undefined, sizeBytes: number): number {
  return lineCount ?? estimateLines(sizeBytes);
}

function estimateLines(sizeBytes: number): number {
  return Math.max(1, Math.round(sizeBytes / 40));
}
