export type FrameworkSourceMap = ReadonlyMap<string, string>;

export function sourceFromExactMembers(
  members: string[],
  sourceByMember: FrameworkSourceMap,
  enabledSources: ReadonlySet<string>,
): string | null {
  const memberSet = new Set(members);
  for (const [member, source] of sourceByMember) {
    if (enabledSources.has(source) && memberSet.has(member)) return source;
  }
  return null;
}

export function sourceFromPrefixedMembers(
  prefixes: string[],
  members: string[],
  sourceByMember: FrameworkSourceMap,
  enabledSources: ReadonlySet<string>,
): string | null {
  const memberSet = new Set(members);
  for (const prefix of prefixes) {
    for (const [member, source] of sourceByMember) {
      if (enabledSources.has(source) && memberSet.has(prefix + member)) return source;
    }
  }
  return null;
}

export function matchingParameters(parameters: string[], allowedNames: ReadonlySet<string>): string[] {
  return parameters.filter((parameter) => allowedNames.has(parameter));
}

export function isKnownHandlerCall(
  contextualCallSite: string | undefined,
  handlerMethods: ReadonlySet<string>,
): boolean {
  return Boolean(contextualCallSite && handlerMethods.has(bareCallName(contextualCallSite)));
}

export function bareCallName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  return dot < 0 ? qualified : qualified.slice(dot + 1);
}
