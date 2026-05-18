export default {
  check: async (_rootPath, files) => {
    return files
      .filter((file) => file.relativePath.endsWith('.ts'))
      .filter((file) => file.relativePath.includes('legacy'))
      .map((file) => ({
        id: 'legacy-typescript-file',
        title: 'Legacy TypeScript file',
        description: `${file.relativePath} is under the legacy tree.`,
        severity: 'warning',
        category: 'custom',
        fixAvailable: false,
        locations: [{ file: file.relativePath, line: 1 }],
      }));
  },
};
