import { buildGraph } from './graph.js';
import { classifyEntrypoint, getTopFolders, inferFrameworkHints, inferScopeLabel } from './heuristics.js';
import { buildTaskContextLines } from './formatters.js';

export function buildAnalysisPackage({ state, analysis, processedFiles, repoMapText = null }) {
    const flags = state?.analysisPackage || {};
    const graph = buildGraph(processedFiles);
    const frameworks = inferFrameworkHints(processedFiles);
    const entrypoints = processedFiles
        .map(file => classifyEntrypoint(file, graph))
        .filter(Boolean)
        .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
    const topFolders = getTopFolders(processedFiles);
    const scopeLabel = inferScopeLabel(processedFiles, analysis, frameworks);

    return {
        enabled: {
            taskContext: flags.taskContext !== false,
            entrypoints: flags.entrypoints !== false,
            moduleGraph: flags.moduleGraph !== false,
            changeScope: flags.changeScope !== false
        },
        metrics: {
            fileCount: processedFiles.length,
            edgeCount: graph.edges.length,
            entrypointCount: entrypoints.length,
            frameworkHints: frameworks,
            scopeLabel
        },
        taskContextLines: buildTaskContextLines({ analysis, frameworks, repoMapText }),
        entrypoints,
        graph,
        topFolders,
        scopeLabel
    };
}