import { describe, it, expect, beforeEach } from 'vitest';
import {
  cosineSimilarity,
  isSemanticAvailable,
  embedBatch,
  __resetEmbeddingsCache,
  EMBEDDING_DIM,
} from '../../src/core/embeddings.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical unit vectors', () => {
    const v = new Float32Array([0.6, 0.8]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0, 0]);
    const b = new Float32Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('returns 0 when dimensions mismatch', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([1, 0, 0]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

describe('isSemanticAvailable', () => {
  beforeEach(() => {
    __resetEmbeddingsCache();
  });

  it('returns true when the peer dep is installed (devDep in this repo)', async () => {
    expect(await isSemanticAvailable()).toBe(true);
  });
});

describe('embedBatch', () => {
  beforeEach(() => {
    __resetEmbeddingsCache();
  });

  it(
    'produces EMBEDDING_DIM-length vectors, with semantic clustering of related strings',
    async () => {
      const texts = [
        'authenticate a user with a password',
        'verify login credentials before issuing a session token',
        'add two numbers together and return the sum',
      ];
      const vectors = await embedBatch(texts);
      expect(vectors).not.toBeNull();
      expect(vectors!).toHaveLength(3);
      expect(vectors![0].length).toBe(EMBEDDING_DIM);

      // The two auth-related strings should be closer to each other than
      // either is to the arithmetic string.
      const authPair = cosineSimilarity(vectors![0], vectors![1]);
      const authVsMath = cosineSimilarity(vectors![0], vectors![2]);
      expect(authPair).toBeGreaterThan(authVsMath);
    },
    60_000,
  );
});
