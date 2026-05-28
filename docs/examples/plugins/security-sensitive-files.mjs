const SECURITY_SENSITIVE = /(^|\/)(auth|crypto|security|secrets?|payments?|billing|middleware)(\/|\.)|\.env(\.|$)|(^|\/)server\.ts$/i;

export default {
  check: async (_rootPath, files) => {
    return files
      .filter((file) => SECURITY_SENSITIVE.test(file.relativePath))
      .slice(0, 25)
      .map((file) => ({
        id: 'security-sensitive-review',
        title: 'Security-sensitive file needs explicit review',
        description: `${file.relativePath} matches a security-sensitive path. Route it to the right owner and verify tests or threat-model notes before merge.`,
        severity: 'warning',
        category: 'security',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      }));
  },
};
