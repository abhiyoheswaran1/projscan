import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hermetic, controllable stand-in for @xenova/transformers so we can simulate a
// model-load failure (e.g. HTTP 429 from the model host, or offline) without
// touching the network.
const pipelineMock = vi.fn();
vi.mock('@xenova/transformers', () => ({
  env: {},
  pipeline: (...args: unknown[]) => pipelineMock(...args),
}));

import { embedText, EMBEDDING_DIM, __resetEmbeddingsCache } from '../../src/core/embeddings.js';

function fakePipeline() {
  return async () => ({
    data: new Float32Array(EMBEDDING_DIM).fill(0.1),
    dims: [1, EMBEDDING_DIM],
  });
}

beforeEach(() => {
  __resetEmbeddingsCache();
  pipelineMock.mockReset();
});

describe('embeddings — graceful degradation on model-load failure', () => {
  it('returns null instead of throwing when the model fails to load (e.g. 429/offline)', async () => {
    pipelineMock.mockRejectedValueOnce(
      new Error('Error (429) while loading model from huggingface.co'),
    );

    await expect(embedText('hello world')).resolves.toBeNull();
  });

  it('does not poison the cache — a later call can still load the model', async () => {
    pipelineMock.mockRejectedValueOnce(new Error('Error (429)'));
    expect(await embedText('first attempt fails')).toBeNull();

    // The transient failure must not be cached: a subsequent call retries and succeeds.
    pipelineMock.mockResolvedValueOnce(fakePipeline());
    const vec = await embedText('second attempt succeeds');
    expect(vec).not.toBeNull();
    expect(vec!.length).toBe(EMBEDDING_DIM);
  });
});
