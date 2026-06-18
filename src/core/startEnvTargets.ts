export function extractEnvVarTarget(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!\s]+$/g, '');
  const processMatch = compactIntent.match(/\bprocess\.env\.[A-Za-z_][A-Za-z0-9_]*\b/);
  if (processMatch?.[0]) return processMatch[0];
  const envMatch = compactIntent.match(/\b([A-Z][A-Z0-9]*_[A-Z0-9_]+)\b/);
  return envMatch?.[1];
}
