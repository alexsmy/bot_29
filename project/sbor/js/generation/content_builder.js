

import { readFile } from '../utils.js';
import { optimizeCode } from '../optimizer.js';

export async function buildProcessedFiles(selectedFilesMeta, detectedSecrets, optimizeCodeFlag) {
    let processedFiles =[];
    let redactedCount = 0;
    let totalCommentsRemoved = 0;
    let totalEmptyLinesRemoved = 0;
    let originalSize = 0;

    const filePromises = selectedFilesMeta.map(f => readFile(f.originalFile));
    const fileContents = await Promise.all(filePromises);
    fileContents.sort((a, b) => a.path.localeCompare(b.path));

    fileContents.forEach(file => {
        let content = file.content;
        originalSize += new Blob([content]).size;
        const lang = file.path.split('.').pop().toLowerCase();

        const fileSecrets = detectedSecrets.filter(s => s.filePath === file.path && s.selected);
        fileSecrets.sort((a, b) => b.matchIndex - a.matchIndex);

        fileSecrets.forEach(sec => {
            const redacted = `${sec.prefix}${sec.quote}*****${sec.quote}`;
            content = content.substring(0, sec.matchIndex) + redacted + content.substring(sec.matchIndex + sec.fullMatch.length);
            redactedCount++;
        });

        if (optimizeCodeFlag) {
            const optResult = optimizeCode(content, lang);
            content = optResult.result;
            totalCommentsRemoved += optResult.stats.commentsRemoved;
            totalEmptyLinesRemoved += optResult.stats.emptyLinesRemoved;
        }

        processedFiles.push({
            path: file.path,
            lang: lang,
            content: content.trim()
        });
    });

    return {
        fileContents,
        processedFiles,
        redactedCount,
        totalCommentsRemoved,
        totalEmptyLinesRemoved,
        originalSize
    };
}

    