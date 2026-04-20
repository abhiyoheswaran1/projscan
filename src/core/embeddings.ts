/**
 * Thin wrapper around `@xenova/transformers` — imported dynamically so we
 * fail softly when the peer dep is absent.
 *
 * Design goals:
 *   - Zero impact when the peer isn't installed (no top-level import).
 *   - Cache the pipeline instance across calls (model load is ~200MB RAM,
 *     ~2s warm-up, so we want to pay that once per process).
 *   - Accept an optional `onFirstLoad` hook so CLIs can show a "downloading
 *     model…" message on the first run.
 */

export const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

export interface EmbedOptions {
  model?: string;
  onFirstLoad?: (message: string) => void;
}

interface EmbedderPipeline {
  (text: string | string[], options?: Record<string, unknown>): Promise<{
    data: Float32Array | number[];
    dims?: number[];
  }>;
}

interface TransformersModule {
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<EmbedderPipeline>;
  env: Record<string, unknown>;
}

let cachedModule: TransformersModule | null | undefined;
const pipelines = new Map<string, Promise<EmbedderPipeline>>();

async function tryLoadTransformers(): Promise<TransformersModule | null> {
  if (cachedModule !== undefined) return cachedModule;
  try {
    const mod = (await import('@xenova/transformers')) as TransformersModule;
    cachedModule = mod;
    // Silence the library's verbose progress output in non-TTY environments.
    // We emit our own status messages via onFirstLoad.
    if (mod.env && typeof mod.env === 'object') {
      (mod.env as Record<string, unknown>).allowLocalModels = false;
    }
    return mod;
  } catch (err) {
    const e = err as { code?: string };
    if (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND') {
      cachedModule = null;
      return null;
    }
    // Unexpected load error — treat as unavailable, log to stderr for diagnosis.
    process.stderr.write(`[projscan] embeddings unavailable: ${err instanceof Error ? err.message : String(err)}\n`);
    cachedModule = null;
    return null;
  }
}

/**
 * Returns true if `@xenova/transformers` is installed and loadable.
 * Lightweight; safe to call multiple times.
 */
export async function isSemanticAvailable(): Promise<boolean> {
  const mod = await tryLoadTransformers();
  return mod !== null;
}

async function getPipeline(model: string, onFirstLoad?: (m: string) => void): Promise<EmbedderPipeline | null> {
  const mod = await tryLoadTransformers();
  if (!mod) return null;

  let existing = pipelines.get(model);
  if (!existing) {
    onFirstLoad?.(`Loading embedding model ${model} (first run downloads ~25MB)...`);
    existing = mod.pipeline('feature-extraction', model, {
      quantized: true,
    });
    pipelines.set(model, existing);
  }
  return existing;
}

/**
 * Embed a single string → Float32Array of EMBEDDING_DIM floats.
 * Returns null if the peer dep is unavailable.
 */
export async function embedText(
  text: string,
  options: EmbedOptions = {},
): Promise<Float32Array | null> {
  const model = options.model ?? DEFAULT_MODEL;
  const pipe = await getPipeline(model, options.onFirstLoad);
  if (!pipe) return null;
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return toFloat32Array(output.data);
}

/**
 * Embed many strings in one batch. Significantly faster than calling
 * embedText repeatedly when indexing a repo.
 */
export async function embedBatch(
  texts: string[],
  options: EmbedOptions = {},
): Promise<Float32Array[] | null> {
  const model = options.model ?? DEFAULT_MODEL;
  const pipe = await getPipeline(model, options.onFirstLoad);
  if (!pipe) return null;
  if (texts.length === 0) return [];

  // The library accepts an array and returns a single tensor shaped
  // [N, EMBEDDING_DIM]. Slice it back into N float32 arrays.
  const output = await pipe(texts, { pooling: 'mean', normalize: true });
  const data = toFloat32Array(output.data);
  const dim = output.dims && output.dims.length > 0 ? output.dims[output.dims.length - 1] : EMBEDDING_DIM;
  const results: Float32Array[] = [];
  for (let i = 0; i < texts.length; i++) {
    results.push(data.slice(i * dim, (i + 1) * dim));
  }
  return results;
}

/** Compute cosine similarity between two already-normalized vectors. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

function toFloat32Array(data: Float32Array | number[]): Float32Array {
  return data instanceof Float32Array ? data : new Float32Array(data);
}

/**
 * Test-only: reset the module / pipeline cache. Called between tests so
 * each suite gets a clean view of availability.
 */
export function __resetEmbeddingsCache(): void {
  cachedModule = undefined;
  pipelines.clear();
}
