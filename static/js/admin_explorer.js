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
    file: ICONS.file
};

let viewerModal, viewerModalTitle, viewerModalBody, viewerModalCloseBtn, modalContent;
let explorerTable;

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

function getFileIcon(filename) {
    const extension = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const info = FILE_TYPE_MAP[extension] || { icon: 'file', type: 'file' };
    const svg = ICONS_EXPLORER[info.icon] || ICONS_EXPLORER.file;
    return `<span class="icon icon-${info.type}">${svg}</span>`;
}

function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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
            const highlightedContent = (filename === 'app.log') ? highlightLogs(data.content) : escapeHtml(data.content);
            viewerModalBody.innerHTML = `<pre><code>${highlightedContent}</code></pre>`;
        } else {
            viewerModalBody.innerHTML = '<p style="padding: 1rem; color: var(--error-color);">Не удалось загрузить содержимое файла.</p>';
        }
    }
}

function escapeHtml(unsafe) {
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function loadExplorerData() {
    const files = await fetchData('explorer/files-flat');
    if (files) {
        explorerTable.setData(files);
    } else {
        explorerTable.setData([]);
        explorerTable.alert("Не удалось загрузить список файлов");
    }
}

function initializeExplorerTable() {
    explorerTable = new Tabulator("#explorer-table", {
        layout: "fitColumns",
        placeholder: "Нет файлов для отображения",
        columns: [
            { title: "", field: "name", hozAlign: "center", headerSort: false, width: 40, formatter: (cell) => getFileIcon(cell.getValue()) },
            { title: "Имя", field: "name", headerFilter: "input", minWidth: 200 },
            { title: "Размер", field: "size", width: 120, hozAlign: "right", sorter: "number", formatter: (cell) => formatBytes(cell.getValue()) },
            { title: "Изменен", field: "modified", width: 180, hozAlign: "center", formatter: (cell) => formatDateShort(cell.getValue()) },
            { title: "Путь", field: "path", minWidth: 200, formatter: "textarea" },
            {
                title: "Действия", width: 220, hozAlign: "center", headerSort: false,
                formatter: (cell) => {
                    const data = cell.getRow().getData();
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
                            alert('Не удалось удалить файл.');
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
    const filterInput = document.getElementById('explorer-filter-input');

    initializeExplorerTable();

    viewerModalCloseBtn.addEventListener('click', closeViewerModal);
    modalOverlay.addEventListener('click', closeViewerModal);
    refreshBtn.addEventListener('click', loadExplorerData);

    filterInput.addEventListener('keyup', () => {
        explorerTable.setFilter("name", "like", filterInput.value);
    });

    const navLink = document.querySelector('a[href="#explorer"]');
    navLink.addEventListener('click', (e) => {
        if (explorerTable.getDataCount() === 0) {
            loadExplorerData();
        }
    });
}