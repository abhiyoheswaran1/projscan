import type { ProofRecipeConfig, ProjscanConfig } from '../types/config.js';

const MAX_RECIPES = 50;
const MAX_LIST_ITEMS = 50;
const MAX_STRING_LENGTH = 300;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const REVIEWER_PATTERN = /^[@A-Za-z0-9][A-Za-z0-9._/-]{0,99}$/;

export function applyProofRecipes(obj: Record<string, unknown>, out: ProjscanConfig): void {
  if (!Array.isArray(obj.proofRecipes)) return;
  const seenIds = new Set<string>();
  const recipes: ProofRecipeConfig[] = [];
  for (const recipe of obj.proofRecipes.slice(0, MAX_RECIPES)) {
    const normalized = normalizeProofRecipe(recipe);
    if (!normalized || seenIds.has(normalized.id)) continue;
    seenIds.add(normalized.id);
    recipes.push(normalized);
  }
  if (recipes.length > 0) out.proofRecipes = recipes;
}

function normalizeProofRecipe(raw: unknown): ProofRecipeConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const id = cleanRecipeId(obj.id);
  const matches = cleanPatternList(obj.matches);
  const requiredCommands = cleanCommandList(obj.requiredCommands);
  if (!id || matches.length === 0 || requiredCommands.length === 0) return null;
  const recipe: ProofRecipeConfig = {
    id,
    matches,
    requiredCommands,
  };
  const requiredReviewers = cleanReviewerList(obj.requiredReviewers);
  const forbiddenFiles = cleanPatternList(obj.forbiddenFiles);
  const riskSurface = cleanString(obj.riskSurface);
  const reason = cleanString(obj.reason);
  if (requiredReviewers.length > 0) recipe.requiredReviewers = requiredReviewers;
  if (forbiddenFiles.length > 0) recipe.forbiddenFiles = forbiddenFiles;
  if (riskSurface) recipe.riskSurface = riskSurface;
  if (reason) recipe.reason = reason;
  return recipe;
}

function cleanCommandList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .slice(0, MAX_LIST_ITEMS)
      .filter(
        (entry): entry is string =>
          typeof entry === 'string' && !entry.includes('\0') && !/[\r\n]/.test(entry),
      )
      .map(cleanString)
      .filter((entry): entry is string => Boolean(entry)),
  );
}

function cleanPatternList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .slice(0, MAX_LIST_ITEMS)
      .map(cleanString)
      .filter((entry): entry is string => typeof entry === 'string' && !/[`<>]/.test(entry)),
  );
}

function cleanReviewerList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .slice(0, MAX_LIST_ITEMS)
      .map(cleanString)
      .filter((entry): entry is string => typeof entry === 'string' && REVIEWER_PATTERN.test(entry)),
  );
}

function cleanRecipeId(value: unknown): string | undefined {
  const id = cleanString(value);
  return id && ID_PATTERN.test(id) ? id : undefined;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/[\0\r\n\t]/.test(value)) return undefined;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > MAX_STRING_LENGTH) return undefined;
  return trimmed;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
