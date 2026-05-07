

import { readFile } from '../utils.js';
import { JS_EXTENSIONS, HTML_EXTENSIONS, CSS_EXTENSIONS, DEPENDENCY_EXTENSIONS } from './constants.js';
import { normalizePath, getPathExtension, dirname, joinPaths, stripQueryHash, findPoolPath } from './path_utils.js';

function getFileContext(filePath) {
    const ext = getPathExtension(filePath);

    if (JS_EXTENSIONS.has(ext)) return 'js';
    if (HTML_EXTENSIONS.has(ext)) return 'html';
    if (CSS_EXTENSIONS.has(ext)) return 'css';
    return 'other';
}

function extractDependencySpecifiers(content, filePath) {
    const ext = getPathExtension(filePath);
    const specs = new Set();

    const addMatches = (regex) => {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (match[1]) specs.add(match[1]);
        }
    };

    const jsPatterns =[
        /import\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g,
        /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
        /require\(\s*['"]([^'"]+)['"]\s*\)/g,
        /import\(\s*['"]([^'"]+)['"]\s*\)/g
    ];

    const htmlPatterns = [
        /<script[^>]*src=["']([^"']+)["'][^>]*>/gi,
        /<link[^>]*href=["']([^"']+)["'][^>]*>/gi
    ];

    const cssPatterns =[
        /@import\s+(?:url\()?['"]([^'"]+)['"]\)?/gi
    ];

    if (JS_EXTENSIONS.has(ext)) {
        jsPatterns.forEach(addMatches);
    }

    if (HTML_EXTENSIONS.has(ext)) {
        htmlPatterns.forEach(addMatches);
    }

    if (CSS_EXTENSIONS.has(ext)) {
        cssPatterns.forEach(addMatches);
    }

    if (ext === '.vue' || ext === '.svelte') {
        jsPatterns.forEach(addMatches);
        htmlPatterns.forEach(addMatches);
    }

    return Array.from(specs);
}

function resolveSpecifier(fromPath, specifier, poolMap, lowerMap, context) {
    const clean = stripQueryHash(specifier).trim();

    if (
        !clean ||
        clean.startsWith('data:') ||
        clean.startsWith('blob:') ||
        clean.startsWith('javascript:') ||
        clean.startsWith('#') ||
        /^https?:\/\//i.test(clean) ||
        /^\/\//.test(clean)
    ) {
        return null;
    }

    const findCandidate = (candidate) => findPoolPath(candidate, poolMap, lowerMap);

    let base = '';
    if (clean.startsWith('/')) {
        base = clean.replace(/^\/+/, '');
    } else if (clean.startsWith('.')) {
        base = joinPaths(dirname(fromPath), clean);
    } else if (context === 'html' || context === 'css') {
        base = joinPaths(dirname(fromPath), clean);
    } else {
        const exact = findCandidate(clean);
        if (exact) return exact;
        return null;
    }

    const candidates = new Set();
    candidates.add(base);

    if (!/\.[a-z0-9]+$/i.test(base)) {
        DEPENDENCY_EXTENSIONS.forEach(ext => {
            candidates.add(`${base}${ext}`);
            candidates.add(`${base}/index${ext}`);
        });
    }

    for (const candidate of candidates) {
        const resolved = findCandidate(candidate);
        if (resolved) return resolved;
    }

    return null;
}

export async function collectDependencies(seedFilePaths, poolMap, lowerMap) {
    const resolvedPaths = new Set();
    const dependencyDetails = [];
    const visited = new Set();
    const queue =[...seedFilePaths];
    const seedSet = new Set(seedFilePaths.map(path => normalizePath(path)));

    while (queue.length > 0) {
        const currentPath = normalizePath(queue.shift());
        if (visited.has(currentPath)) continue;
        visited.add(currentPath);

        const fileInfo = poolMap.get(currentPath) || poolMap.get(lowerMap.get(currentPath.toLowerCase()));
        if (!fileInfo?.originalFile) continue;

        let fileData = null;
        try {
            fileData = await readFile(fileInfo.originalFile);
        } catch {
            continue;
        }

        const content = fileData?.content || '';
        const context = getFileContext(currentPath);
        const specifiers = extractDependencySpecifiers(content, currentPath);

        for (const specifier of specifiers) {
            const resolved = resolveSpecifier(currentPath, specifier, poolMap, lowerMap, context);
            if (!resolved || resolved === currentPath) continue;
            if (seedSet.has(resolved)) continue;
            if (resolvedPaths.has(resolved)) continue;

            resolvedPaths.add(resolved);
            queue.push(resolved);
            dependencyDetails.push({
                from: currentPath,
                to: resolved,
                spec: specifier
            });
        }
    }

    return { paths: resolvedPaths, details: dependencyDetails };
}

    