// static/js/admin_explorer.js

import { fetchData } from './admin_api.js';

const API_TOKEN = document.body.dataset.token;

const ICONS_EXPLORER = {
    caret: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" /></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" /></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V15H12V18H9V15H6V18H4V13H20V18H15Z" /></svg>`,
    python: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.8,15.7C12.8,15.7 12.8,15.7 12.9,15.7C13.3,15.6 13.6,15.2 13.6,14.8V12.8H15.5C16.1,12.8 16.6,12.3 16.6,11.7C16.6,11.1 16.1,10.6 15.5,10.6H13.6V9.7C13.6,9.3 13.3,9 12.9,8.9C12.8,8.9 12.8,8.9 12.8,8.9H10.9C10.3,8.9 9.8,9.4 9.8,10V10.1H8C7.4,10.1 6.9,10.6 6.9,11.2C6.9,11.8 7.4,12.3 8,12.3H9.8V14.2C9.8,14.8 10.3,15.3 10.9,15.3H12.8V15.7M10.8,14.2V12.3H12.6V14.2H10.8M10.8,11.2V10.1H12.6V11.2H10.8M19,16V14.8C19,14.1 18.5,13.6 17.9,13.6H17V12.7C17,12 16.5,11.5 15.9,11.5H15.1V10.6C15.1,9.9 14.6,9.4 14,9.4H12V7.5C12,6.9 11.5,6.4 10.9,6.4H9.1C8.5,6.4 8,6.9 8,7.5V8.4H7.1C6.5,8.4 6,8.9 6,9.5V10.3H5.2C4.5,10.3 4,10.8 4,11.4V13.1C4,13.7 4.5,14.2 5.1,14.2H6V16C6,16.6 6.5,17.1 7.1,17.1H8V18C8,18.6 8.5,19.1 9.1,19.1H11.1L11.1,20.1C11.1,20.7 11.6,21.2 12.2,21.2C12.8,21.2 13.3,20.7 13.3,20.1V19.1H14C14.7,19.1 15.2,18.6 15.2,18V17.1H17.1C17.7,17.1 18.2,16.6 18.2,16V14.9H19V16Z" /></svg>`,
    javascript: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20,2H4A2,2 0 0,0 2,4V20A2,2 0 0,0 4,22H20A2,2 0 0,0 22,20V4A2,2 0 0,0 20,2M11,19H8.5C8.2,19 8,18.8 8,18.5V13.4C8,13.1 8.2,12.9 8.5,12.9H10.2C10.4,12.9 10.6,13.1 10.6,13.3L11,15.3C11.1,15.5 10.9,15.7 10.7,15.7H9.8C9.6,15.7 9.4,15.5 9.4,15.3L9.1,14H8.9L8.8,17.6C8.8,17.9 9,18.1 9.3,18.1H11C11.3,18.1 11.5,17.9 11.5,17.6V16.5C11.5,16.2 11.3,16 11,16H9.8C9.5,16 9.3,16.2 9.3,16.5V17.1H10.5C10.8,17.1 11,16.9 11,16.6V13.8C11,13.5 10.8,13.3 10.5,13.3H11.5C11.8,13.3 12,13.5 12,13.8V18.5C12,18.8 11.8,19 11.5,19H11M17,19H16C15.7,19 15.5,18.8 15.5,18.5V13.4C15.5,13.1 15.7,12.9 16,12.9H17C17.3,12.9 17.5,13.1 17.5,13.4V18.5C17.5,18.8 17.3,19 17,19M13.1,12.9H14.5C14.8,12.9 15,13.1 15,13.4V18.5C15,18.8 14.8,19 14.5,19H13.1C12.8,19 12.6,18.8 12.6,18.5V13.4C12.6,13.1 12.8,12.9 13.1,12.9Z" /></svg>`,
    audio: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12,3V13.55C11.41,13.21 10.73,13 10,13C7.79,13 6,14.79 6,17C6,19.21 7.79,21 10,21C12.21,21 14,19.21 14,17V7H18V3H12Z" /></svg>`
};

let explorerContainer, modal, modalTitle, modalBody, modalCloseBtn, modalOverlay;

const FILE_ICONS = {
    '.py': 'python',
    '.js': 'javascript',
    '.html': 'explorer', // Using existing icon
    '.css': 'explorer',
    '.json': 'explorer',
    '.webm': 'audio',
    '.mp3': 'audio',
    '.log': 'file',
    '.txt': 'file'
};

function getFileIcon(filename) {
    const extension = filename.substring(filename.lastIndexOf('.'));
    const iconName = FILE_ICONS[extension] || 'file';
    return ICONS_EXPLORER[iconName] || ICONS_EXPLORER.file;
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
            html += `
                <li data-path="${node.path}">
                    <div class="tree-item file-item">
                        <span class="icon" style="opacity: 0;"></span>
                        <span class="icon">${getFileIcon(node.name)}</span>
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

function openModal(title) {
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    modal.classList.add('visible');
}

function closeModal() {
    modal.classList.remove('visible');
    modalBody.innerHTML = ''; // Очищаем содержимое, чтобы остановить воспроизведение аудио
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
                .replace(/\b(def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|pass|break|continue|lambda)\b/g, '<span class="hl-keyword">$&</span>')
                .replace(/(".*?"|'.*?')/g, '<span class="hl-string">$&</span>')
                .replace(/(#.*)/g, '<span class="hl-comment">$&</span>')
                .replace(/\b(True|False|None)\b/g, '<span class="hl-boolean">$&</span>')
                .replace(/\b\d+\b/g, '<span class="hl-number">$&</span>');
        case 'html':
             return escapedCode
                .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comment">$1</span>')
                .replace(/(&lt;\/?)([a-zA-Z0-9]+)/g, '$1<span class="hl-tag">$2</span>')
                .replace(/([a-zA-Z-]+)=(".*?")/g, '<span class="hl-attr-name">$1</span>=<span class="hl-attr-value">$2</span>');
        default:
            return escapedCode;
    }
}

async function viewTextFile(path, filename) {
    openModal(filename);
    modalBody.innerHTML = '<p style="padding: 1rem;">Загрузка...</p>';
    const data = await fetchData(`explorer/file-content?path=${encodeURIComponent(path)}`);
    if (data && data.content) {
        const highlightedCode = highlightSyntax(data.content, data.lang);
        modalBody.innerHTML = `<pre><code>${highlightedCode}</code></pre>`;
    } else {
        modalBody.innerHTML = '<p style="padding: 1rem; color: var(--error-color);">Не удалось загрузить содержимое файла.</p>';
    }
}

function playAudioFile(path, filename) {
    openModal(filename);
    const audioUrl = `/api/admin/explorer/file-download?path=${encodeURIComponent(path)}&token=${API_TOKEN}`;
    modalBody.innerHTML = `<audio controls autoplay><source src="${audioUrl}" type="audio/webm"></audio>`;
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
    modal = document.getElementById('explorer-modal');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    modalCloseBtn = document.getElementById('modal-close-btn');
    modalOverlay = document.querySelector('.modal-overlay');
    const refreshBtn = document.getElementById('refresh-explorer-btn');

    explorerContainer.addEventListener('click', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if (folderItem) {
            folderItem.parentElement.classList.toggle('collapsed');
            return;
        }

        const fileItem = e.target.closest('.file-item');
        if (fileItem) {
            const path = fileItem.parentElement.dataset.path;
            const filename = fileItem.querySelector('span:last-of-type').textContent;
            const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
            
            if (['.webm', '.mp3', '.wav', '.ogg'].includes(extension)) {
                playAudioFile(path, filename);
            } else if (['.py', '.js', '.css', '.html', '.json', '.txt', '.log', '.md', '.sh'].includes(extension)) {
                viewTextFile(path, filename);
            }
        }
    });

    modalCloseBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    refreshBtn.addEventListener('click', loadExplorerData);

    const navLink = document.querySelector('a[href="#explorer"]');
    navLink.addEventListener('click', (e) => {
        if (!explorerContainer.innerHTML.trim() || explorerContainer.querySelector('.skeleton-list')) {
            loadExplorerData();
        }
    });
}