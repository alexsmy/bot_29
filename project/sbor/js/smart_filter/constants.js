

export const JS_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']);
export const HTML_EXTENSIONS = new Set(['.html', '.htm', '.vue', '.svelte', '.xml']);
export const CSS_EXTENSIONS = new Set(['.css', '.scss', '.less']);
export const DEPENDENCY_EXTENSIONS =[
    '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
    '.json', '.css', '.scss', '.less',
    '.html', '.htm', '.vue', '.svelte', '.xml',
    '.md', '.txt'
];

export const SMART_PROFILES =[
    {
        id: 'auto',
        name: 'Авто-профиль',
        description: 'Сам определяет наиболее вероятный сценарий по выбранным файлам или папкам.',
        seedMode: 'mixed',
        folderAware: true,
        pruneNonRelevant: false,
        preferredExtensions: null,
        instructions:[
            ''
        ]
    },
    {
        id: 'refactor-file',
        name: 'Рефакторинг большого файла',
        description: 'Делит сложный файл на более простые модули и фасады.',
        seedMode: 'file',
        folderAware: false,
        pruneNonRelevant: false,
        preferredExtensions: null,
        instructions:[
            'Раздели крупные блоки кода на небольшие модули по ответственности.'
        ]
    },
    {
        id: 'refactor-folder',
        name: 'Рефакторинг папки / структуры',
        description: 'Удобен для разложения большого набора файлов по смысловым папкам.',
        seedMode: 'folder',
        folderAware: true,
        pruneNonRelevant: false,
        preferredExtensions: null,
        instructions:[
            'Группируй файлы по функциональным зонам и близким связям.',
            'Упорядочивай импорты и относительные пути без изменения логики.',
            'Если переносишь файлы, покажи новую структуру и связи между модулями.',
            'Избегай косметических изменений, которые не улучшают поддержку.'
        ]
    },
    {
        id: 'feature-update',
        name: 'Улучшение функциональности',
        description: 'Фокус на добавлении или изменении логики без лишнего UI-шума.',
        seedMode: 'file',
        folderAware: true,
        pruneNonRelevant: true,
        preferredExtensions:[
            '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
            '.json', '.yml', '.yaml', '.xml', '.env',
            '.php', '.java', '.cs', '.py', '.go', '.rs', '.swift', '.kt'
        ],
        instructions:[
            'Сосредоточься на исполняемых модулях и их зависимостях.',
            'Стили, тексты и служебные инструкции не трогай без необходимости.',
            'Проверь все import/require/подключения и связанные точки вызова.',
            'Если добавляешь алгоритм, сохрани текущий контракт функций.'
        ]
    },
    {
        id: 'visual-update',
        name: 'Улучшение внешнего вида',
        description: 'Собирает HTML/CSS/UI-скрипты для дизайн-правок.',
        seedMode: 'mixed',
        folderAware: true,
        pruneNonRelevant: true,
        preferredExtensions:[
            '.html', '.htm', '.css', '.scss', '.less',
            '.js', '.ts', '.tsx', '.jsx',
            '.json', '.xml', '.vue', '.svelte', '.svg'
        ],
        instructions:[
            'Работай прежде всего с визуальным слоем: HTML, CSS и UI-скриптами.',
            'Сохраняй поведение, если оно не связано с представлением.',
            'Если меняешь классы или шаблоны, проверь, где они используются.',
            'Подключай новые стили и связанные файлы явно и без догадок.'
        ]
    },
    {
        id: 'cleanup',
        name: 'Очистка и упрощение',
        description: 'Подходит для удаления мусора, дубликатов и наведения порядка.',
        seedMode: 'folder',
        folderAware: true,
        pruneNonRelevant: false,
        preferredExtensions: null,
        instructions:[
            'Ищи неиспользуемые куски кода, дубли и устаревшие ветки логики.',
            'Удаляй только то, в чём уверен, и не ломай рабочие точки входа.',
            'Если убираешь файл, проверь, не импортируется ли он где-то ещё.',
            'Старайся сохранить предсказуемую структуру проекта.'
        ]
    }
];

export const SMART_PROFILE_MAP = SMART_PROFILES.reduce((acc, profile) => {
    acc[profile.id] = profile;
    return acc;
}, {});

    