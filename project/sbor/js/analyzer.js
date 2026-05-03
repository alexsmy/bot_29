

export function analyzeProject(files) {
    const fileNames = files.map(f => (f.name || '').toLowerCase());
    const extCounts = {};

    files.forEach(f => {
        const ext = f.path.split('.').pop().toLowerCase();
        if (ext) extCounts[ext] = (extCounts[ext] || 0) + 1;
    });

    let stack = [];
    let projectType = '';

    if (fileNames.includes('package.json')) stack.push('Node.js / JS / TS');
    if (fileNames.includes('requirements.txt') || fileNames.includes('pyproject.toml')) stack.push('Python');
    if (fileNames.includes('pom.xml') || fileNames.includes('build.gradle')) stack.push('Java');
    if (fileNames.includes('composer.json')) stack.push('PHP');
    if (fileNames.includes('go.mod')) stack.push('Go');
    if (fileNames.includes('cargo.toml')) stack.push('Rust');
    if (fileNames.includes('docker-compose.yml') || fileNames.includes('dockerfile')) stack.push('Docker');

    if (stack.length === 0) {
        const langMap = {
            'py': 'Python',
            'js': 'JavaScript',
            'mjs': 'JavaScript',
            'cjs': 'JavaScript',
            'jsx': 'JavaScript',
            'ts': 'TypeScript',
            'tsx': 'TypeScript',
            'java': 'Java',
            'cs': 'C#',
            'php': 'PHP',
            'go': 'Go',
            'rb': 'Ruby',
            'cpp': 'C++',
            'c': 'C',
            'swift': 'Swift',
            'kt': 'Kotlin',
            'vue': 'Vue',
            'svelte': 'Svelte'
        };

        let maxCount = 0;
        let dominantLang = null;

        for (const [ext, count] of Object.entries(extCounts)) {
            if (langMap[ext] && count > maxCount) {
                maxCount = count;
                dominantLang = langMap[ext];
            }
        }

        if (dominantLang) {
            stack.push(dominantLang);
        } else if (extCounts['html'] || extCounts['css'] || extCounts['vue'] || extCounts['svelte']) {
            stack.push('HTML/CSS Web');
        } else {
            stack.push('Не определен (Смешанный)');
        }
    }

    projectType = stack.join(', ');

    const topExtensions = Object.entries(extCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(e => `.${e[0]}`)
        .join(', ');

    const summaryText = `## 0. META-SUMMARY (АВТО-АНАЛИЗ ПРОЕКТА)
- **Тип проекта / Технологии:** ${projectType}
- **Всего файлов в сборке:** ${files.length}
- **Основные расширения файлов:** ${topExtensions || 'Нет данных'}

*Примечание для ИИ: Ниже представлена полная структура проекта и содержимое файлов. Используй эту сводку для понимания общего контекста.*
`;

    return {
        projectType,
        topExtensions,
        totalFiles: files.length,
        summaryText
    };
}

    