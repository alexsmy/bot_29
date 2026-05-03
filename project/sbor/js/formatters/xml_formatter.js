import { buildAnalysisPackage, formatAnalysisPackageXml } from '../analysis_package.js';

function escapeXmlText(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function escapeXmlAttr(value) {
    return escapeXmlText(value)
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
        .replace(/\r?\n/g, ' ');
}

function safeCdata(value) {
    return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>');
}

export function formatXml(state, analysis, processedFiles, redactedCount, dateStr, repoMapText = null) {
    const packageData = buildAnalysisPackage({ state, analysis, processedFiles, repoMapText });
    let output = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    output += `<project_analysis>\n`;

    output += `  <metadata>\n`;
    output += `    <date>${escapeXmlText(dateStr)}</date>\n`;
    output += `    <project_type>${escapeXmlText(analysis.projectType)}</project_type>\n`;
    output += `    <total_files>${analysis.totalFiles}</total_files>\n`;
    output += `    <top_extensions>${escapeXmlText(analysis.topExtensions || 'Нет данных')}</top_extensions>\n`;
    output += `    <redacted_secrets_count>${redactedCount}</redacted_secrets_count>\n`;
    output += `  </metadata>\n\n`;

    output += `  <project_structure>\n<![CDATA[\n${safeCdata(state.structureString)}\n]]>\n  </project_structure>\n\n`;

    output += formatAnalysisPackageXml(packageData) + '\n\n';

    if (repoMapText) {
        output += `  <repo_map>\n<![CDATA[\n${safeCdata(repoMapText)}\n]]>\n  </repo_map>\n\n`;
    }

    output += `  <excluded_files>\n`;
    if (state.excludedFiles.length > 0) {
        state.excludedFiles.forEach(f => {
            const reasonStr = f.reason === 'size'
                ? (f.reasonLabel || 'Превышен размер')
                : (f.reason === 'git'
                    ? (f.reasonLabel || 'Исключено .gitignore')
                    : (f.reasonLabel || 'Исключено правилами/расширением'));
            output += `    <file path="${escapeXmlAttr(f.path)}" reason="${escapeXmlAttr(reasonStr)}" />\n`;
        });
    } else {
        output += `    <!-- Нет исключенных файлов -->\n`;
    }
    output += `  </excluded_files>\n\n`;

    output += `  <files_content>\n`;
    processedFiles.forEach(f => {
        output += `    <file path="${escapeXmlAttr(f.path)}" language="${escapeXmlAttr(f.lang)}">\n<![CDATA[\n${safeCdata(f.content)}\n]]>\n    </file>\n\n`;
    });
    output += `  </files_content>\n\n`;

    output += `</project_analysis>`;
    return output;
}
