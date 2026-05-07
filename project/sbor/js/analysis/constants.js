export const JS_EXTS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
export const HTML_EXTS = new Set(['.html', '.htm', '.vue', '.svelte', '.xml']);
export const CSS_EXTS = new Set(['.css', '.scss', '.less']);
export const PY_EXTS = new Set(['.py']);
export const PHP_EXTS = new Set(['.php']);

export const ENTRY_NAMES = new Set([
    'index.html', 'index.htm', 'index.php',
    'main.js', 'main.mjs', 'main.cjs', 'main.ts', 'main.tsx', 'main.jsx',
    'app.js', 'app.mjs', 'app.cjs', 'app.ts', 'app.tsx', 'app.jsx',
    'boot.js', 'boot.ts', 'boot.tsx',
    'server.js', 'server.ts', 'server.py', 'main.py', 'index.py', 'manage.py'
]);

export const SUPPORT_FILE_NAMES = new Set([
    'analysis_package.js',
    'md_formatter.js',
    'xml_formatter.js',
    'render_analysis_package.js'
]);