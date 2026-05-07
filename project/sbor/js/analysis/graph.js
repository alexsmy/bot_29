import {
    normalizePath,
    getPathExtension,
    dirname,
    joinPaths,
    stripQueryHash,
    findPoolPath
} from '../smart_filter/path_utils.js';
import { JS_EXTS, HTML_EXTS, CSS_EXTS, PY_EXTS, PHP_EXTS } from './constants.js';

export function buildPool(processedFiles) {
    const poolMap = new Map();
    const lowerMap = new Map();

    processedFiles.forEach(file => {
        const key = normalizePath(file.path);
        poolMap.set(key, file);
        lowerMap.set(key.toLowerCase(), key);
    });

    return { poolMap, lowerMap };
}

export function extractDependencies(content, filePath) {
    const ext = getPathExtension(filePath);
    const specs = new Set();

    const pushMatches = (regex) => {
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(content)) !== null) {
            if (match[1]) specs.add(match[1]);
        }
    };

    if (JS_EXTS.has(ext) || ext === '.json') {
        [
            /import\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g,
            /export\s+\*\s+from\s+['"]([^'"]+)['"]/g,
            /require\(\s*['"]([^'"]+)['"]\s*\)/g,
            /import\(\s*['"]([^'"]+)['"]\s*\)/g
        ].forEach(pushMatches);
    }

    if (HTML_EXTS.has(ext)) {[
            /<script[^>]*src=["']([^"']+)["'][^>]*>/gi,
            /<link[^>]*href=["']([^"']+)["'][^>]*>/gi
        ].forEach(pushMatches);
    }

    if (CSS_EXTS.has(ext)) {[
            /@import\s+(?:url\()?['"]([^'"]+)['"]\)?/gi,
            /url\(\s*['"]?([^'"\)]+)['"]?\s*\)/gi
        ].forEach(pushMatches);
    }

    if (PY_EXTS.has(ext)) {[
            /^\s*import\s+([\w.]+)/gm,
            /^\s*from\s+([\w.]+)\s+import\s+/gm
        ].forEach(pushMatches);
    }

    if (PHP_EXTS.has(ext)) {[
            /(?:include|include_once|require|require_once)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/gi
        ].forEach(pushMatches);
    }

    if (ext === '.vue' || ext === '.svelte') {
        [
            /import\s+(?:type\s+)?(?:[\w*\s{},]+\s+from\s+)?['"]([^'"]+)['"]/g,
            /require\(\s*['"]([^'"]+)['"]\s*\)/g,
            /<script[^>]*src=["']([^"']+)["'][^>]*>/gi,
            /<link[^>]*href=["']([^"']+)["'][^>]*>/gi,
            /@import\s+(?:url\()?['"]([^'"]+)['"]\)?/gi
        ].forEach(pushMatches);
    }

    return Array.from(specs).filter(Boolean);
}

export function resolveSpecifier(fromPath, specifier, poolMap, lowerMap, context) {
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
    const fromDir = dirname(fromPath);

    let base = null;
    if (clean.startsWith('/')) {
        base = clean.replace(/^\/+/, '');
    } else if (clean.startsWith('.')) {
        base = joinPaths(fromDir, clean);
    } else if (context === 'html' || context === 'css' || context === 'php') {
        base = joinPaths(fromDir, clean);
    } else {
        return findCandidate(clean);
    }

    const candidates = new Set([base]);
    if (!/\.[a-z0-9]+$/i.test(base)) {[
            '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.css', '.scss', '.less',
            '.html', '.htm', '.vue', '.svelte', '.xml', '.py', '.php', '.md', '.txt'
        ].forEach(ext => {
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

export function buildGraph(processedFiles) {
    const { poolMap, lowerMap } = buildPool(processedFiles);
    const adjacency = new Map();
    const incoming = new Map();
    const edges =[];

    processedFiles.forEach(file => {
        const path = normalizePath(file.path);
        const content = String(file.content || '');
        const ext = getPathExtension(path);
        const context = JS_EXTS.has(ext) ? 'js'
            : HTML_EXTS.has(ext) ? 'html'
            : CSS_EXTS.has(ext) ? 'css'
            : PY_EXTS.has(ext) ? 'py'
            : PHP_EXTS.has(ext) ? 'php'
            : 'other';
        const specs = extractDependencies(content, path);
        const outgoing =[];

        specs.forEach(spec => {
            const resolved = resolveSpecifier(path, spec, poolMap, lowerMap, context);
            if (!resolved || resolved === path) return;
            outgoing.push({ to: resolved, spec });
            edges.push({ from: path, to: resolved, spec });
            incoming.set(resolved, (incoming.get(resolved) || 0) + 1);
        });

        adjacency.set(path, outgoing);
    });

    return { adjacency, incoming, edges };
}