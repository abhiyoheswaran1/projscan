export function extractInfraArtifactQuery(intent: string): string | undefined {
  const compactIntent = intent.trim().replace(/[?!.\s]+$/g, '');
  return (
    fixedInfraArtifactQuery(compactIntent) ??
    dockerComposeQuery(compactIntent) ??
    infraArtifactFromRules(compactIntent)
  );
}

function fixedInfraArtifactQuery(compactIntent: string): string | undefined {
  if (/\bdockerfile\b/i.test(compactIntent)) return 'Dockerfile';
  if (/\b(?:kubernetes|k8s)\b/i.test(compactIntent) && /\bmanifests?\b/i.test(compactIntent))
    return 'Kubernetes manifests';
  return undefined;
}

function dockerComposeQuery(compactIntent: string): string | undefined {
  const dockerCompose = compactIntent.match(/\bdocker\s+compose(?:\s+(?:for|of)\s+(.+?))?$/i);
  if (dockerCompose) {
    const target = unwrapTarget((dockerCompose[1] ?? '').trim());
    return target ? `${target} docker compose` : 'docker compose';
  }
  return undefined;
}

const INFRA_ARTIFACT_RULES: Array<{
  pattern: RegExp;
  format: (match: RegExpMatchArray) => string | undefined;
}> = [
  {
    pattern:
      /\b(?:find|locate|search(?:\s+for)?|lookup|where\s+(?:is|are))\s+(?:the\s+)?helm\s+charts?\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} Helm chart` : undefined),
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?terraform\s+modules?\s+(?:for|of|on|in)\s+(.+?)$/i,
    format: (match) =>
      match[1] ? `${normalizeInfraTarget(match[1])} Terraform module` : undefined,
  },
  {
    pattern:
      /\b(?:which|what|where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+github\s+workflows?\s+(?:deploys?|for|of|on|in)\s+(.+?)$/i,
    format: (match) => (match[1] ? `${unwrapTarget(match[1].trim())} GitHub workflow` : undefined),
  },
  {
    pattern:
      /\b(?:where\s+(?:is|are)|find|locate|search(?:\s+for)?|lookup)\s+(?:the\s+)?(vercel|netlify|railway|fly)\s+config(?:uration)?$/i,
    format: (match) => (match[1] ? `${normalizeInfraTarget(match[1])} config` : undefined),
  },
];

function infraArtifactFromRules(compactIntent: string): string | undefined {
  for (const rule of INFRA_ARTIFACT_RULES) {
    const match = compactIntent.match(rule.pattern);
    const query = match ? rule.format(match) : undefined;
    if (query) return query;
  }
  return undefined;
}

function normalizeInfraTarget(value: string): string {
  return unwrapTarget(value.trim())
    .replace(/\bs3\b/gi, 'S3')
    .replace(/\bvercel\b/gi, 'Vercel')
    .replace(/\bnetlify\b/gi, 'Netlify')
    .replace(/\brailway\b/gi, 'Railway')
    .replace(/\bfly\b/gi, 'Fly');
}

function unwrapTarget(value: string): string {
  const trimmed = value.trim();
  const wrapped = trimmed.match(/^([`'"])(.+)\1$/);
  return (wrapped?.[2] ?? trimmed).trim();
}
