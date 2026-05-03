

import { removeCStyleComments } from './optimizers/c_style.js';
import { removeHashComments } from './optimizers/hash_style.js';
import { removeHtmlComments } from './optimizers/html_style.js';

export function optimizeCode(content, extension) {
    let optimized = content;
    let commentsRemoved = 0;
    let emptyLinesRemoved = 0;

    const cStyle = ['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'java', 'c', 'cpp', 'cs', 'go', 'php', 'swift', 'kt', 'rs', 'css', 'scss', 'less'];
    const hashStyle = ['py', 'rb', 'sh', 'yaml', 'yml', 'env', 'pl', 'ps1'];
    const htmlStyle = ['html', 'htm', 'xml', 'svg', 'vue', 'svelte'];

    try {
        if (cStyle.includes(extension)) {
            optimized = removeCStyleComments(content, () => commentsRemoved++);
        } else if (hashStyle.includes(extension)) {
            optimized = removeHashComments(content, () => commentsRemoved++);
        } else if (htmlStyle.includes(extension)) {
            optimized = removeHtmlComments(content, () => commentsRemoved++);
        }
    } catch (e) {
        console.warn(`Ошибка при удалении комментариев для .${extension}`, e);
    }

    const linesBefore = optimized.split('\n').length;

    optimized = optimized.replace(/^[ \t]+$/gm, '');
    optimized = optimized.replace(/[ \t]+$/gm, '');
    optimized = optimized.replace(/\n{3,}/g, '\n\n');

    optimized = optimized.trim();
    const linesAfter = optimized.split('\n').length;

    emptyLinesRemoved = linesBefore - linesAfter;
    if (emptyLinesRemoved < 0) emptyLinesRemoved = 0;

    return {
        result: optimized,
        stats: { commentsRemoved, emptyLinesRemoved }
    };
}

    