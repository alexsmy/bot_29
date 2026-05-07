import { normalizePath, getPathExtension } from '../smart_filter/path_utils.js';
import { ENTRY_NAMES, JS_EXTS, HTML_EXTS, PY_EXTS, PHP_EXTS } from './constants.js';
import { basename, isSupportFile, getLanguageLabel, parseJsonSafely } from './utils.js';

export function classifyEntrypoint(file, graph) {
    const path = normalizePath(file.path);
    const ext = getPathExtension(path);
    const name = basename(path).toLowerCase();
    const content = String(file.content || '');
    const outgoingCount = (graph.adjacency.get(path) ||[]).length;
    const incomingCount = graph.incoming.get(path) || 0;
    const reasons =[];
    let score = 0;

    if (ENTRY_NAMES.has(name)) {
        score += 5;
        reasons.push('имя файла указывает на точку входа');
    }

    if (path.split('/').length === 1 && (name.startsWith('index.') || name.startsWith('main.') || name.startsWith('app.'))) {
        score += 3;
        reasons.push('корневой стартовый файл');
    }

    if ((ext === '.html' || ext === '.htm') && /<script[^>]*src=/i.test(content)) {
        score += 2;
        reasons.push('HTML подключает скрипты');
    }

    if ((ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.ts' || ext === '.tsx' || ext === '.jsx') && /\b(createRoot|ReactDOM|bootstrap|initialize|initApp|startApp)\b/i.test(content)) {
        score += 2;
        reasons.push('характерные точки запуска');
    }

    if (ext === '.py' && /if\s+__name__\s*==\s*['"]__main__['"]/i.test(content)) {
        score += 4;
        reasons.push('Python entrypoint через __main__');
    }

    if (ext === '.php' && (name === 'index.php' || /public\/index\.php$/i.test(path))) {
        score += 4;
        reasons.push('PHP фронт-контроллер');
    }

    if (incomingCount === 0 && outgoingCount > 0 && (JS_EXTS.has(ext) || HTML_EXTS.has(ext) || PY_EXTS.has(ext) || PHP_EXTS.has(ext))) {
        score += 2;
        reasons.push('нет входящих зависимостей, но есть исходящие');
    }

    return score > 0 ? { path, label: getLanguageLabel(ext, path), score, reasons } : null;
}

export function getTopFolders(processedFiles, limit = 6) {
    const counts = new Map();

    processedFiles.forEach(file => {
        const parts = normalizePath(file.path).split('/');
        parts.pop();
        let acc = '';
        parts.forEach(part => {
            acc = acc ? `${acc}/${part}` : part;
            counts.set(acc, (counts.get(acc) || 0) + 1);
        });
    });

    return Array.from(counts.entries())
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => (b.count - a.count)
            || (a.path.split('/').length - b.path.split('/').length)
            || a.path.localeCompare(b.path))
        .slice(0, limit);
}

export function hasPackageDependency(pkgJson, names) {
    if (!pkgJson) return false;
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    return sections.some(section => {
        const obj = pkgJson?.[section];
        if (!obj || typeof obj !== 'object') return false;
        return names.some(name => Object.prototype.hasOwnProperty.call(obj, name));
    });
}

export function findPackageJson(entries) {
    return entries.find(entry => basename(entry.path).toLowerCase() === 'package.json') || null;
}

export function findComposerJson(entries) {
    return entries.find(entry => basename(entry.path).toLowerCase() === 'composer.json') || null;
}

export function findRequirementsText(entries) {
    const file = entries.find(entry => basename(entry.path).toLowerCase() === 'requirements.txt');
    return file ? String(file.content || '') : '';
}

export function findPyProjectText(entries) {
    const file = entries.find(entry => basename(entry.path).toLowerCase() === 'pyproject.toml');
    return file ? String(file.content || '') : '';
}

export function inferFrameworkHints(processedFiles) {
    const hints = new Set();
    const entries = processedFiles
        .filter(file => !isSupportFile(file.path))
        .map(file => ({
            path: normalizePath(file.path),
            content: String(file.content || ''),
            ext: getPathExtension(file.path)
        }));

    const packageJson = parseJsonSafely(findPackageJson(entries)?.content);
    const composerJson = parseJsonSafely(findComposerJson(entries)?.content);
    const requirementsText = findRequirementsText(entries).toLowerCase();
    const pyProjectText = findPyProjectText(entries).toLowerCase();
    const composerText = String(findComposerJson(entries)?.content || '').toLowerCase();

    if (entries.some(e => e.ext === '.vue')) hints.add('Vue');
    if (entries.some(e => e.ext === '.svelte')) hints.add('Svelte');

    if (packageJson && hasPackageDependency(packageJson,['react', 'react-dom', 'next', 'vite', 'nuxt', '@angular/core', '@angular/cli'])) {
        if (hasPackageDependency(packageJson, ['react', 'react-dom']) || entries.some(e => /from\s+['"]react['"]/i.test(e.content) || /createRoot\s*\(/i.test(e.content))) {
            hints.add('React');
        }
        if (hasPackageDependency(packageJson, ['next']) || entries.some(e => /next\.config\.[mc]?[jt]s$/i.test(e.path))) {
            hints.add('Next.js');
        }
        if (hasPackageDependency(packageJson, ['vite']) || entries.some(e => /vite\.config\.[mc]?[jt]s$/i.test(e.path))) {
            hints.add('Vite');
        }
        if (hasPackageDependency(packageJson, ['nuxt']) || entries.some(e => /nuxt\.config\.[mc]?[jt]s$/i.test(e.path))) {
            hints.add('Nuxt');
        }
        if (hasPackageDependency(packageJson, ['@angular/core', '@angular/cli']) || entries.some(e => /angular\.json$/i.test(e.path))) {
            hints.add('Angular');
        }
    } else {
        if (entries.some(e => e.ext === '.jsx' || e.ext === '.tsx' || /\bfrom\s+['"]react['"]/i.test(e.content) || /createRoot\s*\(/i.test(e.content))) {
            hints.add('React');
        }
        if (entries.some(e => /next\.config\.[mc]?[jt]s$/i.test(e.path))) hints.add('Next.js');
        if (entries.some(e => /vite\.config\.[mc]?[jt]s$/i.test(e.path))) hints.add('Vite');
        if (entries.some(e => /nuxt\.config\.[mc]?[jt]s$/i.test(e.path))) hints.add('Nuxt');
        if (entries.some(e => /angular\.json$/i.test(e.path) || /\bplatformBrowserDynamic\b|\bbootstrapApplication\b/i.test(e.content))) hints.add('Angular');
    }

    const pythonWebIndicators =['django', 'flask', 'fastapi', 'uvicorn', 'gunicorn', 'starlette', 'quart', 'bottle', 'pyramid'];
    if (
        entries.some(e => e.ext === '.py' && /from\s+(flask|fastapi|django|starlette|quart|bottle|pyramid)/i.test(e.content))
        || pythonWebIndicators.some(token => requirementsText.includes(token) || pyProjectText.includes(token))
    ) {
        hints.add('Python web');
    }

    const phpFrameworkIndicators =['laravel', 'symfony', 'laminas', 'slim', 'yiisoft', 'cakephp', 'codeigniter'];
    if (
        entries.some(e => e.ext === '.php' && /(use\s+Illuminate\\|Symfony\\|Laminas\\|Slim\\|Yii\\|Cake\\)/i.test(e.content))
        || phpFrameworkIndicators.some(token => composerText.includes(token))
    ) {
        hints.add('PHP framework');
    }

    return Array.from(hints);
}

export function inferScopeLabel(processedFiles, analysis, frameworks) {
    const counts = new Map();

    processedFiles.forEach(file => {
        const ext = getPathExtension(file.path) || '.txt';
        counts.set(ext, (counts.get(ext) || 0) + 1);
    });

    const top = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([ext, count]) => `${ext} (${count})`)
        .join(', ');

    const hasWeb =['.html', '.htm', '.css', '.scss', '.less', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'].some(ext => counts.has(ext));
    const hasPy = counts.has('.py');
    const hasPhp = counts.has('.php');
    const hasJvm = counts.has('.java') || counts.has('.kt') || counts.has('.cs');

    let label = 'Смешанный проект';
    if (hasWeb && !hasPy && !hasPhp && !hasJvm) label = 'Веб-интерфейс и клиентская логика';
    else if (hasPy && !hasWeb && !hasPhp && !hasJvm) label = 'Python-центричный проект';
    else if (hasPhp && !hasPy && !hasJvm) label = 'PHP-центричный проект';
    else if (hasJvm) label = 'Java / JVM / C# экосистема';

    const extra =[];
    if (top) extra.push(`доминирующие расширения: ${top}`);
    if (frameworks.length) extra.push(`сигналы: ${frameworks.join(', ')}`);
    if (analysis?.projectType) extra.push(`распознавание: ${analysis.projectType}`);

    return `${label}${extra.length ? '; ' + extra.join('; ') : ''}`;
}