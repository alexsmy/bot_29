function escapeHTML(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

export function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} Б`;

    const units = ['КБ', 'МБ', 'ГБ', 'ТБ'];
    let size = value / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

export function detectFileType(file) {
    const original = file.original_name || '';
    const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';
    const contentType = file.content_type || '';

    const byExtension = {
        html: { label: 'HTML', icon: '🌐', kind: 'code' },
        htm: { label: 'HTML', icon: '🌐', kind: 'code' },
        css: { label: 'CSS', icon: '🎨', kind: 'code' },
        js: { label: 'JavaScript', icon: '⚙️', kind: 'code' },
        json: { label: 'JSON', icon: '🧩', kind: 'code' },
        py: { label: 'Python', icon: '🐍', kind: 'code' },
        png: { label: 'Изображение', icon: '🖼️', kind: 'image' },
        jpg: { label: 'Изображение', icon: '🖼️', kind: 'image' },
        jpeg: { label: 'Изображение', icon: '🖼️', kind: 'image' },
        gif: { label: 'Изображение', icon: '🖼️', kind: 'image' },
        webp: { label: 'Изображение', icon: '🖼️', kind: 'image' },
        svg: { label: 'SVG', icon: '🖼️', kind: 'image' },
        pdf: { label: 'PDF', icon: '📕', kind: 'document' },
        txt: { label: 'Текст', icon: '📝', kind: 'document' },
        md: { label: 'Markdown', icon: '📝', kind: 'document' },
        doc: { label: 'Word', icon: '📘', kind: 'document' },
        docx: { label: 'Word', icon: '📘', kind: 'document' },
        xls: { label: 'Excel', icon: '📗', kind: 'document' },
        xlsx: { label: 'Excel', icon: '📗', kind: 'document' },
        zip: { label: 'Архив', icon: '🗜️', kind: 'archive' },
        rar: { label: 'Архив', icon: '🗜️', kind: 'archive' },
        '7z': { label: 'Архив', icon: '🗜️', kind: 'archive' },
        mp4: { label: 'Видео', icon: '🎬', kind: 'media' },
        mov: { label: 'Видео', icon: '🎬', kind: 'media' },
        mp3: { label: 'Аудио', icon: '🎧', kind: 'media' },
        wav: { label: 'Аудио', icon: '🎧', kind: 'media' }
    };

    if (ext && byExtension[ext]) return byExtension[ext];
    if (contentType.startsWith('image/')) return { label: 'Изображение', icon: '🖼️', kind: 'image' };
    if (contentType.startsWith('text/html')) return { label: 'HTML', icon: '🌐', kind: 'code' };
    if (contentType.startsWith('text/')) return { label: 'Текст', icon: '📝', kind: 'document' };
    if (contentType.includes('pdf')) return { label: 'PDF', icon: '📕', kind: 'document' };
    if (contentType.startsWith('audio/')) return { label: 'Аудио', icon: '🎧', kind: 'media' };
    if (contentType.startsWith('video/')) return { label: 'Видео', icon: '🎬', kind: 'media' };

    return { label: 'Файл', icon: '📄', kind: 'file' };
}

export function renderFileCard(file, selectedFileId = null) {
    const type = detectFileType(file);
    const fileId = escapeHTML(file.file_id);
    const fileName = escapeHTML(file.original_name || file.file_id);
    const publicUrl = escapeHTML(file.public_url);
    const selectedClass = file.file_id === selectedFileId ? ' selected' : '';

    return `
        <article class="file-card${selectedClass}" data-action="select" data-file-id="${fileId}" tabindex="0" aria-label="Выбрать файл ${fileName}">
            <div class="file-icon ${escapeHTML(type.kind)}" aria-hidden="true">${escapeHTML(type.icon)}</div>
            <div class="file-card-body">
                <h3 class="file-title" title="${fileName}">${fileName}</h3>
                <div class="file-meta-line">
                    <span>${escapeHTML(type.label)}</span>
                    <span>${formatBytes(file.size_bytes)}</span>
                    <span>${formatDateTime(file.uploaded_at)}</span>
                </div>
                <a class="file-link" href="${publicUrl}" target="_blank" rel="noopener noreferrer" title="${publicUrl}">${publicUrl}</a>
            </div>
        </article>
    `;
}

export function renderSelectedDetails(file) {
    if (!file) {
        return `
            <div class="details-empty">
                <div class="details-icon">📄</div>
                <h3>Выберите файл</h3>
                <p>Кликните по карточке, чтобы открыть минимальную панель действий: открыть, копировать ссылку или удалить.</p>
            </div>
        `;
    }

    const type = detectFileType(file);
    const fileId = escapeHTML(file.file_id);
    const fileName = escapeHTML(file.original_name || file.file_id);
    const publicUrl = escapeHTML(file.public_url);
    const contentType = escapeHTML(file.content_type || 'application/octet-stream');

    return `
        <article class="selected-file-card">
            <div class="selected-file-head">
                <div class="details-icon ${escapeHTML(type.kind)}">${escapeHTML(type.icon)}</div>
                <div>
                    <p class="panel-kicker">Выбранный файл</p>
                    <h3 title="${fileName}">${fileName}</h3>
                </div>
            </div>

            <dl class="details-list">
                <div><dt>Тип</dt><dd>${escapeHTML(type.label)}</dd></div>
                <div><dt>Размер</dt><dd>${formatBytes(file.size_bytes)}</dd></div>
                <div><dt>Загружен</dt><dd>${formatDateTime(file.uploaded_at)}</dd></div>
                <div><dt>MIME</dt><dd>${contentType}</dd></div>
            </dl>

            <a class="direct-link" href="${publicUrl}" target="_blank" rel="noopener noreferrer">${publicUrl}</a>

            <div class="details-actions">
                <a class="action-button open" href="${publicUrl}" target="_blank" rel="noopener noreferrer">Открыть</a>
                <button class="action-button copy" type="button" data-action="copy" data-file-url="${publicUrl}">Копировать</button>
                <button class="action-button delete" type="button" data-action="delete" data-file-id="${fileId}">Удалить</button>
            </div>
        </article>
    `;
}

export function renderEmptyFilesState(hasFilters = false) {
    const title = hasFilters ? 'Ничего не найдено.' : 'Пока нет загруженных файлов.';
    const text = hasFilters ? 'Измените поисковый запрос или сортировку.' : 'Добавьте файлы через панель загрузки слева.';

    return `
        <div class="file-empty">
            <strong>${title}</strong>
            <span>${text}</span>
        </div>
    `;
}
