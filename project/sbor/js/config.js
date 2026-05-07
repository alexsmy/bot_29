

export const DEFAULT_ALLOWED = [
    '.py', '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
    '.css', '.scss', '.less',
    '.html', '.htm', '.vue', '.svelte',
    '.txt', '.log', '.json', '.xml',
    '.yml', '.yaml', '.md', '.php', '.java', '.cpp', '.h', '.cs',
    '.env', '.sql', '.rb', '.go', '.rs', '.swift', '.kt'
];

export const MAX_FILE_SIZE_MB = 5;

export const EXCLUSION_RULES = [
    {
        id: 'vendor-js',
        label: 'Библиотеки из /lib, /libs, /vendor',
        description: 'Чужие или уже собранные зависимости, которые обычно не нужны для точечных правок.',
        enabled: true,
        match: (file) => {
            const path = file.path.toLowerCase();
            return (
                (path.includes('/lib/') || path.includes('/libs/') || path.includes('/vendor/')) &&
                ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.css', '.scss', '.less'].some(ext => file.name.toLowerCase().endsWith(ext))
            );
        }
    },
    {
        id: 'node_modules',
        label: 'node_modules/',
        description: 'Пакеты зависимостей проекта.',
        enabled: true,
        match: (file) => file.path.toLowerCase().includes('node_modules/')
    },
    {
        id: 'build-artifacts',
        label: 'build / dist / out / coverage',
        description: 'Собранные артефакты, отчёты и временные результаты сборки.',
        enabled: true,
        match: (file) => {
            const path = file.path.toLowerCase();
            return (
                path.includes('/dist/') ||
                path.includes('/build/') ||
                path.includes('/out/') ||
                path.includes('/coverage/') ||
                path.includes('/release/') ||
                path.includes('/target/') ||
                path.includes('/tmp/')
            );
        }
    },
    {
        id: 'git-dir',
        label: '.git/',
        description: 'Внутренние служебные файлы Git.',
        enabled: true,
        match: (file) => file.path.toLowerCase().includes('.git/')
    },
    {
        id: 'pycache',
        label: '__pycache__/',
        description: 'Скомпилированные кэши Python.',
        enabled: true,
        match: (file) => file.path.toLowerCase().includes('__pycache__/')
    },
    {
        id: 'venv',
        label: 'venv / .venv',
        description: 'Виртуальные окружения Python.',
        enabled: true,
        match: (file) => file.path.toLowerCase().includes('venv/') || file.path.toLowerCase().includes('.venv/')
    },
    {
        id: 'minified',
        label: 'Минифицированные файлы',
        description: 'Файлы вида .min.js, .min.css и похожие — обычно шум для анализа.',
        enabled: true,
        match: (file) => {
            const name = file.name.toLowerCase();
            return (
                name.endsWith('.min.js') ||
                name.endsWith('.min.mjs') ||
                name.endsWith('.min.cjs') ||
                name.endsWith('.min.css') ||
                name.endsWith('.min.ts') ||
                name.endsWith('.min.tsx') ||
                name.endsWith('.min.jsx')
            );
        }
    },
    {
        id: 'lockfiles',
        label: 'Lock-файлы',
        description: 'package-lock.json, yarn.lock, pnpm-lock.yaml и аналогичные.',
        enabled: true,
        match: (file) => [
            'package-lock.json',
            'yarn.lock',
            'composer.lock',
            'pnpm-lock.yaml',
            'package-lock.yaml',
            'bun.lockb'
        ].includes(file.name.toLowerCase())
    },
    {
        id: 'dotfiles',
        label: 'Скрытые dot-файлы',
        description: 'Скрытые служебные файлы, кроме .env.',
        enabled: true,
        match: (file) => file.name.startsWith('.') && file.name !== '.env'
    }
];

    