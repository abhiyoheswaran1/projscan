export default {
  check: async (_rootPath, files, context) => {
    if (!context) return [];

    const [semanticGraph, dataflow] = await Promise.all([
      context.getSemanticGraph(),
      context.getDataflow(),
    ]);

    const severity = dataflow.riskCount > 0 ? 'warning' : 'info';
    const fileCount = files.length;
    const functionCount = semanticGraph.metrics.totalFunctions;
    const callEdges = semanticGraph.metrics.totalEdges;

    return [
      {
        id: 'graph-context-summary',
        title: 'Graph context available',
        description:
          `Plugin received ${fileCount} file(s), ${functionCount} function(s), ${callEdges} semantic edge(s), and ${dataflow.riskCount} dataflow risk(s).`,
        severity,
        category: 'architecture',
        fixAvailable: false,
      },
    ];
  },
};
