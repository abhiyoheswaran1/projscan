export function createStableSurface(manifest, options = {}) {
  const cliCommands = options.cliCommands ?? [];
  const exitCodes = options.exitCodes ?? {};
  const liveSurface = {
    schemaVersion: 1,
    mcpTools: {},
    cliCommands: [...cliCommands].sort(),
    exitCodes: { ...exitCodes },
  };

  for (const tool of manifest.tools ?? []) {
    liveSurface.mcpTools[tool.name] = describeMcpTool(tool);
  }

  return liveSurface;
}

export function compareStableSurface(baseline, liveSurface) {
  const baselineToolNames = toolNameSet(baseline);
  const liveToolNames = toolNameSet(liveSurface);
  const issues = [
    ...findRemovedMcpTools(baselineToolNames, liveToolNames),
    ...findMcpToolArgumentIssues(baseline, liveSurface, baselineToolNames, liveToolNames),
    ...findRemovedCliCommands(baseline, liveSurface),
    ...findExitCodeChanges(baseline, liveSurface),
  ];
  const additions = [
    ...findAddedMcpTools(baselineToolNames, liveToolNames),
    ...findAddedMcpArgs(baseline, liveSurface, baselineToolNames, liveToolNames),
    ...findAddedCliCommands(baseline, liveSurface),
  ];

  return {
    schemaVersion: 1,
    status: issues.length === 0 ? 'pass' : 'fail',
    issues,
    additions,
  };
}

function describeMcpTool(tool) {
  const props = tool.inputSchema?.properties ?? {};
  const required = tool.inputSchema?.required ?? [];
  return {
    args: Object.keys(props).sort(),
    required: [...required].sort(),
  };
}

function toolNameSet(surface) {
  return new Set(Object.keys(surface.mcpTools ?? {}));
}

function findRemovedMcpTools(baselineToolNames, liveToolNames) {
  return findSetDifference(baselineToolNames, liveToolNames, (name) => `REMOVED MCP tool: ${name}`);
}

function findMcpToolArgumentIssues(baseline, liveSurface, baselineToolNames, liveToolNames) {
  const issues = [];
  for (const name of baselineToolNames) {
    if (!liveToolNames.has(name)) continue;
    issues.push(...findRemovedMcpArgs(name, baseline, liveSurface));
    issues.push(...findRequiredMcpArgChanges(name, baseline, liveSurface));
  }
  return issues;
}

function findRemovedMcpArgs(name, baseline, liveSurface) {
  const baseTool = baseline.mcpTools[name];
  const liveTool = liveSurface.mcpTools[name];
  return findArrayDifference(
    baseTool.args ?? [],
    liveTool.args ?? [],
    (arg) => `REMOVED arg from ${name}: ${arg}`,
  );
}

function findRequiredMcpArgChanges(name, baseline, liveSurface) {
  const baseTool = baseline.mcpTools[name];
  const liveTool = liveSurface.mcpTools[name];
  const baseRequired = new Set(baseTool.required ?? []);
  const liveRequired = new Set(liveTool.required ?? []);
  return [
    ...findSetDifference(
      liveRequired,
      baseRequired,
      (arg) => `NEW required arg in ${name}: ${arg} (must be optional within a major version)`,
    ),
    ...findSetDifference(
      baseRequired,
      liveRequired,
      (arg) => `required arg ${arg} in ${name} is no longer required (allowed but flag for review)`,
    ),
  ];
}

function findRemovedCliCommands(baseline, liveSurface) {
  return findArrayDifference(
    baseline.cliCommands ?? [],
    liveSurface.cliCommands ?? [],
    (cmd) => `REMOVED CLI command: ${cmd}`,
  );
}

function findExitCodeChanges(baseline, liveSurface) {
  const issues = [];
  for (const [key, value] of Object.entries(baseline.exitCodes ?? {})) {
    const liveValue = liveSurface.exitCodes?.[key];
    if (liveValue !== value) issues.push(`exit code "${key}" changed: ${value} → ${liveValue}`);
  }
  return issues;
}

function findAddedMcpTools(baselineToolNames, liveToolNames) {
  return findSetDifference(liveToolNames, baselineToolNames, (name) => `+ MCP tool: ${name}`);
}

function findAddedMcpArgs(baseline, liveSurface, baselineToolNames, liveToolNames) {
  const additions = [];
  for (const name of liveToolNames) {
    if (!baselineToolNames.has(name)) continue;
    additions.push(...findArgsAddedToTool(name, baseline, liveSurface));
  }
  return additions;
}

function findArgsAddedToTool(name, baseline, liveSurface) {
  return findArrayDifference(
    liveSurface.mcpTools[name].args ?? [],
    baseline.mcpTools[name].args ?? [],
    (arg) => `+ arg ${arg} in ${name}`,
  );
}

function findAddedCliCommands(baseline, liveSurface) {
  return findArrayDifference(
    liveSurface.cliCommands ?? [],
    baseline.cliCommands ?? [],
    (cmd) => `+ CLI command: ${cmd}`,
  );
}

function findArrayDifference(values, existingValues, format) {
  return findSetDifference(new Set(values), new Set(existingValues), format);
}

function findSetDifference(values, existingValues, format) {
  const differences = [];
  for (const value of values) {
    if (!existingValues.has(value)) differences.push(format(value));
  }
  return differences;
}
