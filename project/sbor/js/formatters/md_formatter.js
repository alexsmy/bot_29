import { buildAnalysisPackage, formatAnalysisPackageMarkdown } from '../analysis_package.js';

export function formatMarkdown(state, analysis, processedFiles, redactedCount, dateStr, repoMapText = null) {
    const header = `# ЗАПРОС НА АНАЛИЗ ПРОЕКТА\nДата: ${dateStr}\n\n`;
    const packageData = buildAnalysisPackage({ state, analysis, processedFiles, repoMapText });

    const section1 = `## 1. ПОЛНАЯ СТРУКТУРА ПРОЕКТА\n(Включая бинарные файлы и исключенные из чтения)\n\`\`\`\n${state.structureString}\n\`\`\`\n\n`;

    let section2 = '';
    if (repoMapText) {
        section2 = `## 2. REPO MAP (Скелет проекта)\n(Краткая сводка экспортов, классов и функций для понимания архитектуры)\n\n${repoMapText}\n\n--------------------------------\n\n`;
    }

    const analysisPackageSection = formatAnalysisPackageMarkdown(packageData) + '\n\n--------------------------------\n\n';

    let excludedText = `## ${repoMapText ? '3' : '2'}. ИСКЛЮЧЕННЫЕ ФАЙЛЫ\n(Эти файлы есть в структуре, но их содержимое не передано для экономии контекста)\n`;
    if (state.excludedFiles.length > 0) {
        state.excludedFiles.forEach(f => {
            const reasonStr = f.reason === 'size'
                ? (f.reasonLabel || `> 5MB`)
                : (f.reason === 'git'
                    ? (f.reasonLabel || '.gitignore')
                    : (f.reasonLabel || 'Правила/расширение'));
            excludedText += `- **${f.path}** (${reasonStr})\n`;
        });
    } else {
        excludedText += `- Нет исключенных файлов\n`;
    }
    excludedText += `\n--------------------------------\n\n`;

    let processedContents = '';
    processedFiles.forEach(f => {
        processedContents += `--- FILE: ${f.path} ---\n\`\`\`${f.lang}\n${f.content}\n\`\`\`\n\n`;
    });

    const sectionFinal = `## ${repoMapText ? '4' : '3'}. СОДЕРЖИМОЕ ФАЙЛОВ\n(Обнаружено и скрыто ключей: ${redactedCount})\n\n${processedContents}`;

    return header + (analysis.summaryText || '') + "--------------------------------\n\n" + section1 + "--------------------------------\n\n" + section2 + analysisPackageSection + excludedText + sectionFinal;
}
