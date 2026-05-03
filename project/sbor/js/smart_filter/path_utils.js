

export function normalizePath(path) {
    const raw = String(path || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
    const parts = raw.split('/').filter(Boolean);
    const stack =[];

    for (const part of parts) {
        if (part === '.') continue;
        if (part === '..') {
            if (stack.length > 0) stack.pop();
            continue;
        }
        stack.push(part);
    }

    return stack.join('/');
}

export function getPathExtension(path) {
    const base = normalizePath(path).split('/').pop() || '';
    const idx = base.lastIndexOf('.');
    if (idx === -1) return '';
    return base.slice(idx).toLowerCase();
}

export function dirname(path) {
    const normalized = normalizePath(path);
    const idx = normalized.lastIndexOf('/');
    if (idx === -1) return '';
    return normalized.slice(0, idx);
}

export function joinPaths(base, relative) {
    if (!base) return normalizePath(relative);
    return normalizePath(`${base}/${relative}`);
}

export function stripQueryHash(specifier) {
    return String(specifier || '').split('?')[0].split('#')[0];
}

export function findPoolPath(path, poolMap, lowerMap) {
    const normalized = normalizePath(path);
    if (poolMap.has(normalized)) return normalized;

    const lowerKey = lowerMap.get(normalized.toLowerCase());
    return lowerKey || null;
}

    