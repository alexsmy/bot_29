

import { normalizePath, getPathExtension, dirname } from './path_utils.js';

export function inferSmartProfile(seedFiles, seedFolders, poolMap) {
    const selectedFileInfos = seedFiles
        .map(path => poolMap.get(normalizePath(path)))
        .filter(Boolean);

    if (selectedFileInfos.length === 0 && seedFolders.length > 0) {
        if (seedFolders.length >= 2) return 'cleanup';
        return 'refactor-folder';
    }

    if (selectedFileInfos.length === 0) return 'auto';

    const extCounts = new Map();
    const folderCounts = new Map();
    let totalSize = 0;

    selectedFileInfos.forEach(info => {
        const ext = getPathExtension(info.path) || '';
        extCounts.set(ext, (extCounts.get(ext) || 0) + 1);
        const folder = dirname(info.path) || '';
        folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
        totalSize += info.originalFile?.size || 0;
    });

    const countBy = (...exts) => exts.reduce((sum, ext) => sum + (extCounts.get(ext) || 0), 0);
    const markupCount = countBy('.html', '.htm', '.vue', '.svelte', '.xml');
    const styleCount = countBy('.css', '.scss', '.less');
    const codeCount = countBy('.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.php', '.java', '.cs', '.py', '.go', '.rs', '.swift', '.kt');
    const configCount = countBy('.json', '.yml', '.yaml', '.env', '.xml');

    if (selectedFileInfos.length === 1) {
        const only = selectedFileInfos[0];
        const size = only.originalFile?.size || 0;
        const ext = getPathExtension(only.path);

        if (size >= 150 * 1024) return 'refactor-file';
        if (['.html', '.htm', '.vue', '.svelte', '.css', '.scss', '.less'].includes(ext)) return 'visual-update';
        return 'refactor-file';
    }

    const biggestFolderCount = Math.max(0, ...Array.from(folderCounts.values()));
    if (seedFolders.length > 0 && biggestFolderCount <= selectedFileInfos.length / 2) {
        return 'refactor-folder';
    }

    if (markupCount > 0 && styleCount > 0) {
        return 'visual-update';
    }

    if (codeCount >= 1 && styleCount === 0 && markupCount === 0) {
        if (selectedFileInfos.length >= 4 || totalSize > 250 * 1024) {
            return 'feature-update';
        }
    }

    if (selectedFileInfos.length >= 5 || configCount > 0) {
        return 'cleanup';
    }

    return 'auto';
}

    