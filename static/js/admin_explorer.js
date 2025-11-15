
// static/js/admin_explorer.js

import { fetchData } from './admin_api.js';

const API_TOKEN = document.body.dataset.token;

// Расширяем набор иконок
const ICONS_EXPLORER = {
    caret: ICONS.caret,
    folder: ICONS.folder,
    file: ICONS.file,
    python: ICONS.python,
    javascript: ICONS.javascript,
    html: ICONS.html,
    css: ICONS.css,
    json: ICONS.json,
    image: ICONS.image,
    audio: ICONS.audio,
    archive: ICONS.archive,
    doc: ICONS.doc
};

let explorerContainer, viewerModal, viewerModalTitle, viewerModalBody, viewerModalCloseBtn,
    actionModal, actionModalTitle, actionViewBtn, actionDownloadBtn, actionModalCloseBtn;

// Определяем типы файлов для иконок и доступных действий
const FILE_TYPE_MAP = {
    '.py': { icon: 'python', type: 'code' },
    '.js': { icon: 'javascript', type: 'code' },
    '.html': { icon: 'html', type: 'code' },
    '.css': { icon: 'css', type: 'code' },
    '.json': { icon: 'json', type: 'code' },
    '.log': { icon: 'doc', type: 'doc' },
    '.txt': { icon: 'doc', type: 'doc' },
    '.md': { icon: 'doc', type: 'doc' },
    '.sh': { icon: 'code', type: 'code' },
    '.png': { icon: 'image', type: 'image' },
    '.jpg': { icon: 'image', type: 'image' },
    '.jpeg': { icon: 'image', type: 'image' },
    '.gif': { icon: 'image', type: 'image' },
    '.svg': { icon: 'image', type: 'image' },
    '.webp': { icon: 'image', type: 'image' },
    '.webm': { icon: 'audio', type: 'audio' },
    '.mp3': { icon: 'audio', type: 'audio' },
    '.wav': { icon: 'audio', type: 'audio' },
    '.ogg': { icon: 'audio', type: 'audio' },
    '.zip': { icon: 'archive', type: 'archive' },
    '.rar': { icon: 'archive', type: 'archive' },
    '.7z': { icon: 'archive', type: 'archive' },
};

const VIEWABLE_EXTENSIONS = ['.py', '.js', '.css', '.html', '.json', '.txt', '.log', '.md', '.sh', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.webm', '.mp3', '.wav', '.ogg'];

function getFileInfo(filename) {
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const info = FILE_TYPE_MAP[extension] || { icon: 'file', type: 'file' };
    return {
        svg: ICONS_EXPLORER[info.icon] || ICONS_EXPLORER.file,
        className: `icon-${info.type}`
    };
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDateShort(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('ru-RU', {
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function renderTree(nodes) {
    if (!nodes || nodes.length === 0) return '';
    let html = '<ul>';
    for (const node of nodes) {
        if (node.type === 'directory') {
            html += `
                <li class="folder collapsed" data-path="${node.path}">
                    <div class="tree-item folder-item">
                        <span class="icon caret">${ICONS_EXPLORER.caret}</span>
                        <span class="icon">${ICONS_EXPLORER.folder}</span>
                        <span>${node.name}</span>
                    </div>
                    ${renderTree(node.children)}
                </li>`;
        } else {
            const fileInfo = getFileInfo(node.name);
            html += `
                <li data-path="${node.path}" data-filename="${node.name}">
                    <div class="tree-item file-item">
                        <span class="icon" style="opacity: 0;"></span>
                        <span class="icon ${fileInfo.className}">${fileInfo.svg}</span>
                        <span>${node.name}</span>
                        <div class="file-meta">
                            <span>${formatBytes(node.size)}</span>
                            <span>${formatDateShort(node.modified)}</span>
                        </div>
                    </div>
                </li>`;
        }
    }
    html += '</ul>';
    return html;
}

function closeAllModals() {
    viewerModal.classList.remove('visible');
    actionModal.classList.remove('visible');
    viewerModalBody.innerHTML = ''; // Останавливаем воспроизведение аудио/видео
}

function showActionModal(x, y, path, filename) {
    closeAllModals();
    actionModalTitle.textContent = filename;

    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    actionViewBtn.disabled = !VIEWABLE_EXTENSIONS.includes(extension);

    // Удаляем старые обработчики, чтобы избежать многократных вызовов
    const newViewBtn = actionViewBtn.cloneNode(true);
    actionViewBtn.parentNode.replaceChild(newViewBtn, actionViewBtn);
    actionViewBtn = newViewBtn;

    const newDownloadBtn = actionDownloadBtn.cloneNode(true);
    actionDownloadBtn.parentNode.replaceChild(newDownloadBtn, actionDownloadBtn);
    actionDownloadBtn = newDownloadBtn;

    // Добавляем новые обработчики
    actionViewBtn.addEventListener('click', () => viewFile(path, filename));
    actionDownloadBtn.addEventListener('click', () => {
        const downloadUrl = `/api/admin/explorer/file-download?path=${encodeURIComponent(path)}&token=${API_TOKEN}`;
        // Создаем временную ссылку для скачивания, чтобы задать имя файла
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        closeAllModals();
    });

    // Позиционируем модальное окно
    actionModal.style.left = `${x + 15}px`;
    actionModal.style.top = `${y + 15}px`;
    actionModal.classList.add('visible');
}

async function viewFile(path, filename) {
    closeAllModals();
    viewerModalTitle.textContent = filename;
    viewerModal.classList.add('visible');
    viewerModalBody.innerHTML = '<p style="padding: 1rem;">Загрузка...</p>';

    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const fileUrl = `/api/admin/explorer/file-download?path=${encodeURIComponent(path)}&token=${API_TOKEN}`;

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) {
        viewerModalBody.innerHTML = `<img src="${fileUrl}" alt="${filename}">`;
    } else if (['.webm', '.mp3', '.wav', '.ogg'].includes(extension)) {
        viewerModalBody.innerHTML = `<audio controls autoplay><source src="${fileUrl}"></audio>`;
    } else {
        const data = await fetchData(`explorer/file-content?path=${encodeURIComponent(path)}`);
        if (data && data.content) {
            const highlightedCode = highlightSyntax(data.content, data.lang);
            viewerModalBody.innerHTML = `<pre><code>${highlightedCode}</code></pre>`;
        } else {
            viewerModalBody.innerHTML = '<p style="padding: 1rem; color: var(--error-color);">Не удалось загрузить содержимое файла. Возможно, он не является текстовым.</p>';
        }
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function highlightSyntax(code, lang) {
    const escapedCode = escapeHtml(code);
    switch (lang) {
        case 'js':
        case 'json':
            return escapedCode
                .replace(/\b(const|let|var|function|return|if|else|for|while|switch|case|break|new|import|export|from|async|await|try|catch|finally)\b/g, '<span class="hl-keyword">$&</span>')
                .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="hl-string">$&</span>')
                .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="hl-comment">$&</span>')
                .replace(/\b(true|false|null|undefined)\b/g, '<span class="hl-boolean">$&</span>')
                .replace(/\b\d+\b/g, '<span class="hl-number">$&</span>');
        case 'py':
            return escapedCode
                .replace(/\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|pass|break|continue|lambda|async|await)\b/g, '<span class="hl-keyword">$&</span>')
                .replace(/(".*?"|'.*?')/g, '<span class="hl-string">$&</span>')
                .replace(/(#.*)/g, '<span class="hl-comment">$&</span>')
                .replace(/\b(True|False|None)\b/g, '<span class="hl-boolean">$&</span>')
                .replace(/\b\d+\b/g, '<span class="hl-number">$&</span>');
        case 'html':
             return escapedCode
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>')
                .replace(/(&lt;\/?)([a-zA-Z0-9-]+)/g, '$1<span class="hl-tag">$2</span>')
                .replace(/([a-zA-Z-]+)=(".*?")/g, '<span class="hl-attr-name">$1</span>=<span class="hl-attr-value">$2</span>');
        default:
            return escapedCode;
    }
}

async function loadExplorerData() {
    explorerContainer.innerHTML = '<div class="skeleton-list"></div>';
    const treeData = await fetchData('file-explorer');
    if (treeData) {
        explorerContainer.innerHTML = renderTree(treeData);
    } else {
        explorerContainer.innerHTML = '<p class="empty-list">Не удалось загрузить структуру файлов.</p>';
    }
}

export function initExplorer() {
    explorerContainer = document.getElementById('file-explorer-container');
    viewerModal = document.getElementById('viewer-modal');
    viewerModalTitle = document.getElementById('viewer-modal-title');
    viewerModalBody = document.getElementById('viewer-modal-body');
    viewerModalCloseBtn = document.getElementById('viewer-modal-close-btn');
    
    actionModal = document.getElementById('action-modal');
    actionModalTitle = document.getElementById('action-modal-title');
    actionViewBtn = document.getElementById('action-view-btn');
    actionDownloadBtn = document.getElementById('action-download-btn');
    actionModalCloseBtn = document.getElementById('action-modal-close-btn');

    const refreshBtn = document.getElementById('refresh-explorer-btn');
    const modalOverlay = document.querySelector('.modal-overlay');

    explorerContainer.addEventListener('click', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if (folderItem) {
            folderItem.parentElement.classList.toggle('collapsed');
            return;
        }

        const fileItem = e.target.closest('.file-item');
        if (fileItem) {
            e.preventDefault();
            const path = fileItem.parentElement.dataset.path;
            const filename = fileItem.parentElement.dataset.filename;
            showActionModal(e.clientX, e.clientY, path, filename);
        }
    });

    viewerModalCloseBtn.addEventListener('click', closeAllModals);
    actionModalCloseBtn.addEventListener('click', closeAllModals);
    modalOverlay.addEventListener('click', closeAllModals);
    document.addEventListener('click', (e) => {
        if (actionModal.classList.contains('visible') && !actionModal.contains(e.target) && !e.target.closest('.file-item')) {
            closeAllModals();
        }
    });

    refreshBtn.addEventListener('click', loadExplorerData);

    const navLink = document.querySelector('a[href="#explorer"]');
    navLink.addEventListener('click', (e) => {
        if (!explorerContainer.innerHTML.trim() || explorerContainer.querySelector('.skeleton-list')) {
            loadExplorerData();
        }
    });
}