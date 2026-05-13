export function escapeHTML(value) {
    return String(value)
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

export function detectTypeLabel(file) {
    const original = file.original_name || '';
    const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';

    const map = {
        html: 'HTML',
        htm: 'HTML',
        css: 'CSS',
        js: 'JavaScript',
        json: 'JSON',
        png: 'Изображение',
        jpg: 'Изображение',
        jpeg: 'Изображение',
        gif: 'Изображение',
        webp: 'Изображение',
        svg: 'Изображение',
        pdf: 'PDF',
        txt: 'Текст',
        md: 'Markdown',
        zip: 'Архив',
        rar: 'Архив',
        mp4: 'Видео',
        mp3: 'Аудио'
    };

    if (ext && map[ext]) {
        return map[ext];
    }

    if (file.content_type) {
        if (file.content_type.startsWith('image/')) return 'Изображение';
        if (file.content_type.startsWith('text/html')) return 'HTML';
        if (file.content_type.startsWith('text/')) return 'Текст';
        if (file.content_type.includes('pdf')) return 'PDF';
    }

    return 'Файл';
}

export function renderSelectedFiles(files) {
    if (!files.length) {
        return '<div class="empty-state">Файлы еще не выбраны.</div>';
    }

    return files.map((file, index) => `
        <div class="selected-chip">
            <div class="selected-row" style="flex:1">
                <strong class="selected-chip-name">${escapeHTML(file.name)}</strong>
                <span class="selected-chip-meta">${formatBytes(file.size)}</span>
            </div>
            <span class="selected-count">#${index + 1}</span>
        </div>
    `).join('');
}

export function renderFileCard(file) {
    const publicUrl = escapeHTML(file.public_url);
    const fileName = escapeHTML(file.original_name || file.file_id);
    const sizeText = formatBytes(file.size_bytes);
    const uploadedAt = formatDateTime(file.uploaded_at);
    const typeLabel = escapeHTML(detectTypeLabel(file));
    const fileId = escapeHTML(file.file_id);
    const storageName = escapeHTML(file.storage_name || file.file_id);
    const mime = escapeHTML(file.content_type || 'application/octet-stream');

    return `
        <article class="file-card" data-file-id="${fileId}">
            <div class="file-main">
                <div>
                    <p class="file-title">${fileName}</p>
                    <div class="file-meta">
                        <span class="file-type">${typeLabel}</span>
                        <span>Размер: ${sizeText}</span><br>
                        <span>Загружен: ${uploadedAt}</span>
                    </div>
                </div>
                <button class="file-action delete" type="button" data-action="delete" data-file-id="${fileId}">Удалить</button>
            </div>

            <div class="file-path">${publicUrl}</div>
            <div class="file-meta">Storage: ${storageName} · MIME: ${mime}</div>

            <div class="file-actions">
                <a class="file-action open" href="${publicUrl}" target="_blank" rel="noopener noreferrer">Открыть в новой вкладке</a>
                <button class="file-action copy" type="button" data-action="copy" data-file-url="${publicUrl}">Копировать ссылку</button>
                <button class="file-action" type="button" data-action="copy-name" data-file-name="${fileName}">Копировать имя</button>
            </div>
        </article>
    `;
}

export function renderEmptyFilesState() {
    return `
        <div class="file-empty">
            <strong>Пока нет загруженных файлов.</strong>
            <span>Выберите один или несколько файлов и отправьте их на сервер.</span>
        </div>
    `;
}
