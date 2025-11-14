// static/js/admin_explorer.js (НОВЫЙ ФАЙЛ)

import { fetchData } from './admin_api.js';

const ICONS_EXPLORER = {
    caret: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" /></svg>`,
    folder: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z" /></svg>`,
    file: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V15H12V18H9V15H6V18H4V13H20V18H15Z" /></svg>`
};

let explorerContainer;

function renderTree(nodes) {
    if (!nodes || nodes.length === 0) {
        return '';
    }

    let html = '<ul>';
    for (const node of nodes) {
        if (node.type === 'directory') {
            html += `
                <li class="folder collapsed">
                    <div class="tree-item folder-item">
                        <span class="icon caret">${ICONS_EXPLORER.caret}</span>
                        <span class="icon">${ICONS_EXPLORER.folder}</span>
                        <span>${node.name}</span>
                    </div>
                    ${renderTree(node.children)}
                </li>`;
        } else {
            html += `
                <li>
                    <div class="tree-item">
                        <span class="icon" style="opacity: 0;"></span>
                        <span class="icon">${ICONS_EXPLORER.file}</span>
                        <span>${node.name}</span>
                    </div>
                </li>`;
        }
    }
    html += '</ul>';
    return html;
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
    const refreshBtn = document.getElementById('refresh-explorer-btn');

    explorerContainer.addEventListener('click', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if (folderItem) {
            folderItem.parentElement.classList.toggle('collapsed');
        }
    });

    refreshBtn.addEventListener('click', loadExplorerData);

    const navLink = document.querySelector('a[href="#explorer"]');
    navLink.addEventListener('click', (e) => {
        // Загружаем только если контейнер пуст, чтобы не делать лишних запросов
        if (!explorerContainer.innerHTML.trim() || explorerContainer.querySelector('.skeleton-list')) {
            loadExplorerData();
        }
    });
}