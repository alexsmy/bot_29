import { escapeHtml, escapeXmlAttr, escapeCdata } from './utils.js';

export function buildTaskContextLines({ analysis, frameworks, repoMapText }) {
    const lines =[];
    lines.push(`Тип проекта: ${analysis.projectType || 'не определён'}; файлов в сборке: ${analysis.totalFiles}; основные расширения: ${analysis.topExtensions || 'нет данных'}.`);

    if (frameworks.length) {
        lines.push(`Сигналы экосистемы: ${frameworks.join(', ')}.`);
    }

    if (repoMapText) {
        lines.push('Repo map приложен как сводка символов и публичных точек входа.');
    }

    return lines;
}

export function buildModuleGraphMarkdown(graph, limitPerFile = 8) {
    const groups = [];

    for (const [from, deps] of graph.adjacency.entries()) {
        if (!deps || deps.length === 0) continue;
        groups.push({ from, deps: deps.slice(0, limitPerFile), total: deps.length });
    }

    if (groups.length === 0) {
        return '- Граф зависимостей пуст: в текущей сборке не найдено ссылок между файлами.';
    }

    groups.sort((a, b) => a.from.localeCompare(b.from));
    let result = '';

    groups.forEach(group => {
        result += `- **${escapeHtml(group.from)}**\n`;
        group.deps.forEach(dep => {
            result += `  - → \`${escapeHtml(dep.to)}\` ${dep.spec ? `(${escapeHtml(dep.spec)})` : ''}\n`;
        });
        if (group.total > group.deps.length) {
            result += `  - … ещё ${group.total - group.deps.length} связей\n`;
        }
    });

    return result.trim();
}

export function buildModuleGraphXml(graph, limitPerFile = 8) {
    const groups = [];

    for (const [from, deps] of graph.adjacency.entries()) {
        if (!deps || deps.length === 0) continue;
        groups.push({ from, deps: deps.slice(0, limitPerFile), total: deps.length });
    }

    if (groups.length === 0) {
        return '    <empty>true</empty>';
    }

    groups.sort((a, b) => a.from.localeCompare(b.from));
    let xml = '';

    groups.forEach(group => {
        xml += `    <file path="${escapeXmlAttr(group.from)}" total_dependencies="${group.total}">\n`;
        group.deps.forEach(dep => {
            xml += `      <depends_to path="${escapeXmlAttr(dep.to)}" spec="${escapeXmlAttr(dep.spec || '')}" />\n`;
        });
        if (group.total > group.deps.length) {
            xml += `      <truncated remaining="${group.total - group.deps.length}" />\n`;
        }
        xml += '    </file>\n';
    });

    return xml.trimEnd();
}

export function formatAnalysisPackageMarkdown(packageData) {
    const lines =[];
    let sectionIndex = 1;

    lines.push('## 1. ПАКЕТ ДЛЯ АНАЛИЗА');
    lines.push('(Блоки можно использовать как готовый контекст для ИИ)');

    if (packageData.enabled.taskContext) {
        lines.push('');
        lines.push(`### 1.${sectionIndex++}. TASK_CONTEXT`);
        packageData.taskContextLines.forEach(line => lines.push(`- ${line}`));
    }

    if (packageData.enabled.entrypoints) {
        lines.push('');
        lines.push(`### 1.${sectionIndex++}. ENTRYPOINTS`);
        if (packageData.entrypoints.length === 0) {
            lines.push('- Точки входа не определены эвристикой.');
        } else {
            packageData.entrypoints.forEach(item => {
                const reason = item.reasons.length ? item.reasons.join('; ') : 'эвристическая точка входа';
                lines.push(`- \`${escapeHtml(item.path)}\` — ${escapeHtml(reason)}`);
            });
        }
    }

    if (packageData.enabled.moduleGraph) {
        lines.push('');
        lines.push(`### 1.${sectionIndex++}. MODULE_GRAPH`);
        lines.push(packageData.graph.edges.length ? buildModuleGraphMarkdown(packageData.graph, packageData.metrics.fileCount > 120 ? 6 : 10) : '- Граф зависимостей пуст.');
    }

    if (packageData.enabled.changeScope) {
        lines.push('');
        lines.push(`### 1.${sectionIndex++}. CHANGE_SCOPE`);
        lines.push(`- ${escapeHtml(packageData.scopeLabel)}`);
        if (packageData.topFolders.length) {
            lines.push('- Приоритетные папки:');
            packageData.topFolders.forEach(folder => {
                lines.push(`  - ${escapeHtml(folder.path)} (${folder.count})`);
            });
        }
    }

    return lines.join('\n');
}

export function formatAnalysisPackageXml(packageData) {
    let xml = '  <analysis_package>\n';

    if (packageData.enabled.taskContext) {
        xml += '    <task_context>\n';
        packageData.taskContextLines.forEach(line => {
            xml += `      <line><![CDATA[${escapeCdata(line)}]]]]><![CDATA[></line>\n`;
        });
        xml += '    </task_context>\n';
    }

    if (packageData.enabled.entrypoints) {
        xml += '    <entrypoints>\n';
        if (packageData.entrypoints.length === 0) {
            xml += '      <empty>true</empty>\n';
        } else {
            packageData.entrypoints.forEach(item => {
                xml += `      <file path="${escapeXmlAttr(item.path)}" score="${item.score}" label="${escapeXmlAttr(item.label)}" reasons="${escapeXmlAttr(item.reasons.join(' | '))}" />\n`;
            });
        }
        xml += '    </entrypoints>\n';
    }

    if (packageData.enabled.moduleGraph) {
        xml += '    <module_graph>\n';
        xml += `${buildModuleGraphXml(packageData.graph, packageData.metrics.fileCount > 120 ? 6 : 10)}\n`;
        xml += '    </module_graph>\n';
    }

    if (packageData.enabled.changeScope) {
        xml += '    <change_scope>\n';
        xml += `      <summary><![CDATA[${escapeCdata(packageData.scopeLabel)}]]]]><![CDATA[></summary>\n`;
        xml += '      <top_folders>\n';
        packageData.topFolders.forEach(folder => {
            xml += `        <folder path="${escapeXmlAttr(folder.path)}" files="${folder.count}" />\n`;
        });
        xml += '      </top_folders>\n';
        xml += '    </change_scope>\n';
    }

    xml += '  </analysis_package>';
    return xml;
}