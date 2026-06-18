export function splitPep508(spec: string): { name: string; versionSpec: string } {
  // Strip environment markers: `foo; python_version < "3.10"`.
  const semi = spec.indexOf(';');
  let core = semi >= 0 ? spec.slice(0, semi) : spec;
  // Strip extras: `foo[extra1,extra2]`.
  core = core.replace(/\[[^\]]*\]/, '');
  core = core.trim();
  // Name is up to the first version-spec character or whitespace.
  const m = /^([A-Za-z0-9_][\w.-]*)(.*)$/.exec(core);
  if (!m) return { name: '', versionSpec: '' };
  return { name: m[1].toLowerCase(), versionSpec: m[2].trim() };
}
