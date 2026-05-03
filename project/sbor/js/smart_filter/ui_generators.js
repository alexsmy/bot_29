

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function buildSummaryHtml({
    profileLabel,
    seedFiles,
    seedFolders,
    folderExpandedCount,
    dependencyPaths,
    finalPaths,
    prunedCount,
    dependencyDetails
}) {
    const finalList = Array.from(finalPaths).sort((a, b) => a.localeCompare(b));
    const chips = finalList.length > 0
        ? finalList.slice(0, 8).map(path => `<span class="file-tag smart">${escapeHtml(path)}</span>`).join(' ')
        : '<span class="file-tag warning">контекст пуст</span>';

    const dependencyPreview = dependencyDetails.length > 0
        ? dependencyDetails
            .slice(0, 4)
            .map(dep => `<div>• <strong>${escapeHtml(dep.from)}</strong> → <strong>${escapeHtml(dep.to)}</strong></div>`)
            .join('')
        : '<div>• Связей не обнаружено.</div>';

    return `
        <div class="info-box smart-summary">
            <strong style="display:block; margin-bottom:8px; color:#0f172a;">🧠 ${escapeHtml(profileLabel)}</strong>
            <div>
                Сидов: <strong>${seedFiles.length + seedFolders.length}</strong> |
                По папке: <strong>${folderExpandedCount}</strong> |
                Зависимости: <strong>${dependencyPaths.size}</strong> |
                Отсеяно: <strong>${prunedCount}</strong> |
                Итог: <strong>${finalPaths.size}</strong>
            </div>
            <div style="margin-top:8px;">${chips}</div>
            <div class="rule-meta" style="margin-top:8px;">${dependencyPreview}</div>
        </div>
    `;
}

    