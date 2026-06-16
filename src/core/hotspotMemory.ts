import type { FileHotspot } from '../types.js';

export async function markAcceptedHotspots(rootPath: string, top: FileHotspot[]): Promise<void> {
  try {
    const { loadMemory, saveMemory, recordHotspots, findAcceptedHotspots } =
      await import('./memory.js');
    const memory = await loadMemory(rootPath);
    recordHotspots(
      memory,
      top.map((h) => ({
        file: h.relativePath,
        cc: h.cyclomaticComplexity,
        churn: h.churn,
      })),
    );
    const accepted = new Set(findAcceptedHotspots(memory).map((o) => o.file));
    for (const h of top) {
      if (accepted.has(h.relativePath)) h.accepted = true;
    }
    await saveMemory(rootPath, memory);
  } catch {
    // Best-effort: memory tagging should never break hotspot analysis.
  }
}
