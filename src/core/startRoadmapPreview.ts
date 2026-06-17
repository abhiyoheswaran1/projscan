import fs from 'node:fs/promises';
import path from 'node:path';
import {
  defaultRoadmapLinesForVersion,
  roadmapTasksForLine,
} from './roadmapCatalog.js';
import type { StartRoadmapPreview } from '../types/start.js';

export async function buildStartRoadmapPreview(
  rootPath: string,
): Promise<StartRoadmapPreview | undefined> {
  const lines = defaultRoadmapLinesForVersion(await readPackageVersion(rootPath));
  if (!lines || lines.length === 0) return undefined;

  return {
    policy: 'product-readiness-plan',
    readOnly: true,
    lines,
    workstreams: lines.flatMap((line) =>
      roadmapTasksForLine(line).map((task) => ({
        id: task.id,
        title: task.title,
        priority: task.priority,
        track: task.track,
        verificationCommand: task.verification.commands[0],
      })),
    ),
  };
}

async function readPackageVersion(rootPath: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(rootPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === 'string' ? pkg.version : null;
  } catch {
    return null;
  }
}
