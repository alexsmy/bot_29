import { getFileIcon, getFileColor } from './ui.js';

export function escapeHTML(value) {
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

    const units = ['КБ', 'МБ', 'ГБ', 'ТБ', 'ПБ'];
    let size = value / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    const precision = size >= 10 ? 0 : 1;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
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

function renderFolderBranch(node, activeFolderId) {
    const children = Array.isArray(node.children) ? node.children : [];
    const isActive = (node.folder_id ?? null) === (activeFolderId ?? null);
    const level = Number(node.level) || 0;
    const folderId = node.folder_id ? escapeHTML(node.folder_id) : '';
    const name = escapeHTML(node.name || 'Папка');
    const path = escapeHTML(node.path || node.name || 'Корень');
    const count = Number(node.file_count) || 0;
    const size = formatBytes(node.size_bytes);

    return `
        <div class="folder-branch level-${level}">
            <button class="folder-node${isActive ? ' active' : ''}" type="button" data-action="select-folder" data-folder-id="${folderId}" aria-label="Открыть папку ${path}">
                <span class="folder-dot" aria-hidden="true"></span>
                <span class="folder-name" title="${path}">${name}</span>
                <span class="folder-badge">${count}</span>
                <span class="folder-size" title="Занято">${escapeHTML(size)}</span>
            </button>
            ${children.length ? children.map((child) => renderFolderBranch(child, activeFolderId)).join('') : ''}
        </div>
    `;
}

export function renderFolderTree(tree, activeFolderId = null, rootCount = null) {
    const rootActive = activeFolderId === null || activeFolderId === '' || typeof activeFolderId === 'undefined';
    const rootBadge = rootCount === null || typeof rootCount === 'undefined'
        ? (Array.isArray(tree) ? tree.reduce((sum, node) => sum + (Number(node.file_count) || 0), 0) : 0)
        : Number(rootCount) || 0;

    return `
        <div class="folder-branch root">
            <button class="folder-node${rootActive ? ' active' : ''}" type="button" data-action="select-folder" data-folder-id="" aria-label="Открыть корень хранилища">
                <span class="folder-dot" aria-hidden="true"></span>
                <span class="folder-name">Корень хранилища</span>
                <span class="folder-badge">${rootBadge}</span>
                <span class="folder-size">—</span>
            </button>
            ${Array.isArray(tree) ? tree.map((node) => renderFolderBranch(node, activeFolderId)).join('') : ''}
        </div>
    `;
}

export function renderFolderOptions(tree, activeFolderId = null, excludeFolderId = null, depth = 0) {
    const indent = depth ? `${'— '.repeat(depth)}` : '';
    const exclude = excludeFolderId ?? null;
    const active = activeFolderId ?? null;

    const renderNode = (node, level = 0) => {
        const folderId = node.folder_id ?? null;
        const isExcluded = folderId && exclude && folderId === exclude;
        if (isExcluded) return '';

        const selected = folderId === active ? ' selected' : '';
        const label = `${'— '.repeat(level)}${node.name || 'Папка'}`;
        const options = [
            `<option value="${folderId ? escapeHTML(folderId) : ''}"${selected}>${escapeHTML(label || 'Корень')}</option>`
        ];

        const children = Array.isArray(node.children) ? node.children : [];
        for (const child of children) {
            options.push(renderNode(child, level + 1));
        }
        return options.join('');
    };

    const rootOption = `<option value=""${active === null ? ' selected' : ''}>Корень хранилища</option>`;
    const nodes = Array.isArray(tree) ? tree.map((node) => renderNode(node, 1)).join('') : '';
    return rootOption + nodes;
}

export function renderFileCard(file, isSelected = false) {
    const fileId = escapeHTML(file.file_id);
    const fileName = escapeHTML(file.original_name || file.file_id);
    const checked = isSelected ? ' checked' : '';
    const iconClass = getFileIcon(file);
    const iconColor = getFileColor(file);

    return `
        <article class="file-card${isSelected ? ' selected' : ''}" tabindex="0" data-action="select-file" data-file-id="${fileId}" aria-label="Файл ${fileName}">
            <label class="file-check" aria-label="Выбрать файл ${fileName}">
                <input type="checkbox" data-action="toggle-file" data-file-id="${fileId}"${checked}>
            </label>
            <div class="file-card-main">
                <h3 class="file-title" title="${fileName}">
                    <i class="${iconClass}" style="color: ${iconColor}; margin-right: 6px;"></i>
                    ${fileName}
                </h3>
            </div>
        </article>
    `;
}

export function renderSelectedDetails(file) {
    if (!file) {
        return `
            <div class="details-empty">
                <div class="details-icon"><i class="fa-solid fa-file-circle-question"></i></div>
                <h3>Ничего не выбрано</h3>
                <p>Кликните на карточку файла, чтобы увидеть подробности и действия</p>
            </div>
        `;
    }

    const typeInfo = detectFileType(file);
    const fileId = escapeHTML(file.file_id);
    const fileName = escapeHTML(file.original_name || file.file_id);
    const publicUrl = escapeHTML(file.public_url);
    const contentType = escapeHTML(file.content_type || 'application/octet-stream');
    const folderPath = escapeHTML(file.folder_path || 'Корень');
    const iconClass = getFileIcon(file);
    const iconColor = getFileColor(file);

    return `
        <article class="selected-file-card">
            <div class="selected-file-head">
                <div class="details-icon" style="color: ${iconColor}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="selected-file-title">
                    <p class="panel-kicker">Файл</p>
                    <h3 title="${fileName}">${fileName}</h3>
                </div>
            </div>

            <dl class="details-list">
                <div><dt>Тип</dt><dd>${escapeHTML(typeInfo.label)}</dd></div>
                <div><dt>Размер</dt><dd>${formatBytes(file.size_bytes)}</dd></div>
                <div><dt>Папка</dt><dd title="${folderPath}">${folderPath}</dd></div>
                <div><dt>Загружен</dt><dd>${formatDateTime(file.uploaded_at)}</dd></div>
                <div><dt>MIME</dt><dd title="${contentType}">${contentType}</dd></div>
            </dl>

            <a class="direct-link" href="#" data-action="copy-link" data-file-url="${publicUrl}" title="${publicUrl}">
                <i class="fa-solid fa-link" style="margin-right: 6px;"></i>
                ${publicUrl}
            </a>

            <div class="details-actions">
                <button class="action-button open" type="button" data-action="open-file" data-file-url="${publicUrl}" title="Открыть в новой вкладке">
                    <i class="fa-solid fa-up-right-from-square"></i>
                    Открыть
                </button>
                <button class="action-button copy" type="button" data-action="copy-link" data-file-url="${publicUrl}" title="Скопировать ссылку">
                    <i class="fa-solid fa-copy"></i>
                    Копия
                </button>
                <button class="action-button rename" type="button" data-action="rename-file" data-file-id="${fileId}" data-file-name="${fileName}" title="Переименовать файл">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="action-button move" type="button" data-action="move-file" data-file-id="${fileId}" title="Переместить в другую папку">
                    <i class="fa-solid fa-folder-open"></i>
                </button>
                <button class="action-button delete" type="button" data-action="delete-file" data-file-id="${fileId}" data-file-name="${fileName}" title="Удалить файл">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        </article>
    `;
}

export function detectFileType(file) {
    const original = file.original_name || '';
    const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';
    const contentType = file.content_type || '';

    const byExtension = {
        html: { label: 'HTML', kind: 'code' },
        htm: { label: 'HTML', kind: 'code' },
        css: { label: 'CSS', kind: 'code' },
        js: { label: 'JavaScript', kind: 'code' },
        json: { label: 'JSON', kind: 'code' },
        py: { label: 'Python', kind: 'code' },
        png: { label: 'Изображение', kind: 'image' },
        jpg: { label: 'Изображение', kind: 'image' },
        jpeg: { label: 'Изображение', kind: 'image' },
        gif: { label: 'Изображение', kind: 'image' },
        webp: { label: 'Изображение', kind: 'image' },
        svg: { label: 'SVG', kind: 'image' },
        pdf: { label: 'PDF', kind: 'document' },
        txt: { label: 'Текст', kind: 'document' },
        md: { label: 'Markdown', kind: 'document' },
        doc: { label: 'Word', kind: 'document' },
        docx: { label: 'Word', kind: 'document' },
        xls: { label: 'Excel', kind: 'document' },
        xlsx: { label: 'Excel', kind: 'document' },
        zip: { label: 'Архив', kind: 'archive' },
        rar: { label: 'Архив', kind: 'archive' },
        '7z': { label: 'Архив', kind: 'archive' },
        mp4: { label: 'Видео', kind: 'media' },
        mov: { label: 'Видео', kind: 'media' },
        mp3: { label: 'Аудио', kind: 'media' },
        wav: { label: 'Аудио', kind: 'media' }
    };

    if (ext && byExtension[ext]) return byExtension[ext];
    if (contentType.startsWith('image/')) return { label: 'Изображение', kind: 'image' };
    if (contentType.startsWith('text/html')) return { label: 'HTML', kind: 'code' };
    if (contentType.startsWith('text/')) return { label: 'Текст', kind: 'document' };
    if (contentType.includes('pdf')) return { label: 'PDF', kind: 'document' };
    if (contentType.startsWith('audio/')) return { label: 'Аудио', kind: 'media' };
    if (contentType.startsWith('video/')) return { label: 'Видео', kind: 'media' };

    return { label: 'Файл', kind: 'file' };
}

export function renderEmptyFilesState(message = 'Пока нет файлов.') {
    return `
        <div class="file-empty">
            <strong>${escapeHTML(message)}</strong>
            <span>Добавьте файлы через загрузчик слева или смените папку</span>
        </div>
    `;
}

export function renderBulkSummary(selectedCount, folderLabel = 'Корень') {
    const label = selectedCount === 1 ? 'файл выбран' : 'файлов выбрано';
    return `
        <div class="bulk-summary">
            <strong>${selectedCount} ${label}</strong>
            <span>Папка: ${escapeHTML(folderLabel)}</span>
        </div>
    `;
}

export function toFolderSelectLabel(folder) {
    const path = folder.path || folder.name || 'Папка';
    return path === 'Корень' ? 'Корень' : path.replace(/^Корень\s*\/\s*/, '');
}
