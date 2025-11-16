import { fetchData } from './admin_api.js';
import { highlightLogs } from './admin_utils.js';

const API_TOKEN = document.body.dataset.token;

const ICONS_EXPLORER = {
    python: ICONS.python,
    javascript: ICONS.javascript,
    html: ICONS.html,
    css: ICONS.css,
    json: ICONS.json,
    image: ICONS.image,
    audio: ICONS.audio,
    archive: ICONS.archive,
    doc: ICONS.doc,
    file: ICONS.file,
    folder: ICONS.folder
};

let viewerModal, viewerModalTitle, viewerModalBody, viewerModalCloseBtn, modalContent;
let explorerTable;

const FILE_TYPE_MAP = {
    '.py': { icon: 'python' }, '.js': { icon: 'javascript' }, '.html': { icon: 'html' },
    '.css': { icon: 'css' }, '.json': { icon: 'json' }, '.log': { icon: 'doc' },
    '.txt': { icon: 'doc' }, '.md': { icon: 'doc' }, '.sh': { icon: 'code' },
    '.png': { icon: 'image' }, '.jpg': { icon: 'image' }, '.jpeg': { icon: 'image' },
    '.gif': { icon: 'image' }, '.svg': { icon: 'image' }, '.webp': { icon: 'image' },
    '.webm': { icon: 'audio' }, '.mp3': { icon: 'audio' }, '.wav': { icon: 'audio' },
    '.ogg': { icon: 'audio' }, '.zip': { icon: 'archive' }, '.rar': { icon: 'archive' },
    '.7z': { icon: 'archive' }
};

const VIEWABLE_EXTENSIONS = ['.py', '.js', '.css', '.html', '.json', '.txt', '.log', '.md', '.sh', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.webm', '.mp3', '.wav', '.ogg'];

function getFileIcon(filename, isFolder) {
    if (isFolder) {
        return `<span class="icon">${ICONS_EXPLORER.folder}</span>`;
    }
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const info = FILE_TYPE_MAP[extension] || { icon: 'file' };
    const svg = ICONS_EXPLORER[info.icon] || ICONS_EXPLORER.file;
    return `<span class="icon">${svg}</span>`;
}

function formatBytes(bytes) {
    if (bytes === undefined || bytes === null) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDateShort(isoString) {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('ru-RU', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

function closeViewerModal() {
    viewerModal.classList.remove('visible');
    viewerModalBody.innerHTML = '';
    modalContent.classList.remove('log-viewer');
    document.documentElement.classList.remove('hljs-theme-dark', 'hljs-theme-light');
}

async function viewFile(path, filename) {
    closeViewerModal();
    viewerModalTitle.textContent = filename;
    if (filename === 'app.log') {
        modalContent.classList.add('log-viewer');
    }
    viewerModal.classList.add('visible');
    viewerModalBody.innerHTML = '<p style="padding: 1rem;">Загрузка...</p>';

    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const fileUrl = `/api/admin/explorer/file-download?path=${encodeURIComponent(path)}&token=${API_TOKEN}`;

    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extension)) {
        const img = new Image();
        img.src = fileUrl;
        img.alt = filename;
        img.addEventListener('click', () => img.classList.toggle('zoomed-in'));
        viewerModalBody.innerHTML = '';
        viewerModalBody.appendChild(img);
    } else if (['.webm', '.mp3', '.wav', '.ogg'].includes(extension)) {
        viewerModalBody.innerHTML = `<audio controls autoplay><source src="${fileUrl}"></audio>`;
    } else {
        const data = await fetchData(`explorer/file-content?path=${encodeURIComponent(path)}`);
        if (data && data.content) {
            const codeBlock = document.createElement('code');
            if (filename === 'app.log') {
                codeBlock.innerHTML = highlightLogs(data.content);
            } else {
                codeBlock.textContent = data.content;
                // Применяем тему для highlight.js
                const theme = localStorage.getItem('theme') || 'light';
                document.documentElement.classList.add(theme === 'dark' ? 'hljs-theme-dark' : 'hljs-theme-light');
                // Подсвечиваем синтаксис
                hljs.highlightElement(codeBlock);
            }
            const preBlock = document.createElement('pre');
            preBlock.appendChild(codeBlock);
            viewerModalBody.innerHTML = '';
            viewerModalBody.appendChild(preBlock);
        } else {
            viewerModalBody.innerHTML = '<p style="padding: 1rem; color: var(--error-color);">Не удалось загрузить содержимое файла.</p>';
        }
    }
}

async function loadExplorerData() {
    const files = await fetchData('explorer/files-tree');
    if (files) {
        explorerTable.setData(files);
    } else {
        explorerTable.setData([]);
    }
}

function initializeExplorerTable() {
    explorerTable = new Tabulator("#explorer-table", {
        dataTree: true,
        dataTreeStartExpanded: false,
        layout: "fitColumns",
        placeholder: "Файлы не найдены",
        columns: [
            {
                title: "Имя", field: "name", minWidth: 300, headerFilter: "input",
                formatter: (cell) => {
                    const isFolder = !!cell.getRow().getData()._children;
                    return `${getFileIcon(cell.getValue(), isFolder)}<span>${cell.getValue()}</span>`;
                }
            },
            { title: "Размер", field: "size", width: 120, hozAlign: "right", sorter: "number", formatter: (cell) => formatBytes(cell.getValue()) },
            { title: "Изменен", field: "modified", width: 180, hozAlign: "center", formatter: (cell) => formatDateShort(cell.getValue()) },
            {
                title: "Действия", width: 250, hozAlign: "center", headerSort: false,
                formatter: (cell) => {
                    const data = cell.getRow().getData();
                    if (data._children) return ''; // Нет действий для папок

                    const extension = data.name.substring(data.name.lastIndexOf('.')).toLowerCase();
                    const canView = VIEWABLE_EXTENSIONS.includes(extension);
                    return `
                        <button class="action-btn" data-action="view" ${!canView ? 'disabled' : ''}>Просмотр</button>
                        <button class="action-btn" data-action="download">Скачать</button>
                        <button class="action-btn danger" data-action="delete">Удалить</button>
                    `;
                }
            }
        ],
    });

    explorerTable.on("cellClick", (e, cell) => {
        const action = e.target.dataset.action;
        if (!action) return;

        const rowData = cell.getRow().getData();
        
        if (action === 'view') {
            viewFile(rowData.path, rowData.name);
        } else if (action === 'download') {
            window.location.href = `/api/admin/explorer/file-download?path=${encodeURIComponent(rowData.path)}&token=${API_TOKEN}`;
        } else if (action === 'delete') {
            if (confirm(`Вы уверены, что хотите удалить файл "${rowData.name}"? Это действие необратимо.`)) {
                fetchData(`explorer/file?path=${encodeURIComponent(rowData.path)}`, { method: 'DELETE' })
                    .then(result => {
                        if (result && result.status === 'deleted') {
                            cell.getRow().delete();
                        } else {
                            alert('Не удалось удалить файл. Возможно, удаление этого типа файлов запрещено.');
                        }
                    });
            }
        }
    });
}

export function initExplorer() {
    viewerModal = document.getElementById('viewer-modal');
    viewerModalTitle = document.getElementById('viewer-modal-title');
    viewerModalBody = document.getElementById('viewer-modal-body');
    viewerModalCloseBtn = document.getElementById('viewer-modal-close-btn');
    modalContent = document.querySelector('.modal-content');
    
    const refreshBtn = document.getElementById('refresh-explorer-btn');
    const modalOverlay = document.querySelector('.modal-overlay');

    initializeExplorerTable();

    viewerModalCloseBtn.addEventListener('click', closeViewerModal);
    modalOverlay.addEventListener('click', closeViewerModal);
    refreshBtn.addEventListener('click', loadExplorerData);

    const navLink = document.querySelector('a[href="#explorer"]');
    navLink.addEventListener('click', (e) => {
        if (explorerTable.getDataCount() === 0) {
            loadExplorerData();
        }
    });

    // Переключение тем для Tabulator и highlight.js
    const themeToggle = document.getElementById('theme-toggle');
    themeToggle.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        const tableEl = document.getElementById('explorer-table');
        if (isDark) {
            tableEl.classList.add('tabulator-dark');
        } else {
            tableEl.classList.remove('tabulator-dark');
        }
    });
    // Применяем тему при загрузке
    if (localStorage.getItem('theme') === 'dark') {
        document.getElementById('explorer-table').classList.add('tabulator-dark');
    }
}