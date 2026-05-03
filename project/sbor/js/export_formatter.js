

import { formatXml } from './formatters/xml_formatter.js';
import { formatMarkdown } from './formatters/md_formatter.js';

export function formatOutput(state, analysis, processedFiles, redactedCount, repoMapText = null) {
    const dateStr = new Date().toLocaleString();

    if (state.exportFormat === 'xml') {
        return formatXml(state, analysis, processedFiles, redactedCount, dateStr, repoMapText);
    } else {
        return formatMarkdown(state, analysis, processedFiles, redactedCount, dateStr, repoMapText);
    }
}

    