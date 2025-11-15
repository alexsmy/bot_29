import { fetchData } from './admin_api.js';

let recordsListContainer;
const API_TOKEN = document.body.dataset.token;

function getFileIcon(filename) {
    if (filename.endsWith('.webm')) return '🎤';
    if (filename.includes('_screenshot.png')) return '🖼️';
    if (filename.includes('_dialog.txt')) return '💬';
    if (filename.includes('_resume.txt')) return '📄';
    if (filename.endsWith('.txt')) return '📝';
    return '📁';
}

function renderFileItem(session_id, filename) {
    const icon = getFileIcon(filename);
    return `
        <div class="file-item">
            <span class="file-icon">${icon}</span>
            <span class="file-name">${filename}</span>
            <div class="file-actions">
                <button class="action-btn" onclick="window.location.href='/api/admin/recordings/${session_id}/${filename}?token=${API_TOKEN}'">Скачать</button>
                <button class="action-btn danger" data-session-id="${session_id}" data-filename="${filename}">Удалить</button>
            </div>
        </div>
    `;
}

function renderRecordSession(session) {
    const filesHtml = session.files.map(file => renderFileItem(session.session_id, file)).join('');

    return `
        <details class="record-session-item">
            <summary>
                <span class="session-id">${session.session_id}</span>
                <span class="file-count-badge">${session.files.length} файлов</span>
            </summary>
            <div class="session-files-container">
                ${filesHtml || '<p class="empty-list-small">В этой сессии нет файлов.</p>'}
            </div>
        </details>
    `;
}

async function loadRecords() {
    recordsListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const sessions = await fetchData('recordings');
    if (sessions && sessions.length > 0) {
        recordsListContainer.innerHTML = sessions.map(renderRecordSession).join('');
    } else {
        recordsListContainer.innerHTML = '<p class="empty-list">Записи звонков не найдены.</p>';
    }
}

export function initCallRecords() {
    recordsListContainer = document.getElementById('call-records-list');

    // Добавляем стили для нового отображения
    const style = document.createElement('style');
    style.textContent = `
        .record-session-item {
            background-color: var(--surface-bg);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            margin-bottom: 1rem;
            transition: box-shadow 0.2s;
        }
        .record-session-item:hover {
            box-shadow: var(--shadow-md);
        }
        .record-session-item summary {
            padding: 1rem 1.25rem;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .session-id {
            font-family: monospace;
            color: var(--accent-color);
        }
        .file-count-badge {
            font-size: 0.8em;
            font-weight: 500;
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            background-color: var(--base-bg);
            color: var(--text-secondary);
        }
        .session-files-container {
            padding: 0 1.25rem 1.25rem;
            border-top: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        .file-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.5rem;
            border-radius: 4px;
        }
        .file-item:hover {
            background-color: var(--base-bg);
        }
        .file-icon { font-size: 1.2em; }
        .file-name { flex-grow: 1; font-family: monospace; font-size: 0.9em; }
        .file-actions { display: flex; gap: 0.5rem; }
        .empty-list-small { font-size: 0.9em; color: var(--text-secondary); padding: 0.5rem; }
    `;
    document.head.appendChild(style);

    recordsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('danger') && e.target.dataset.filename) {
            const filename = e.target.dataset.filename;
            const sessionId = e.target.dataset.sessionId;
            if (confirm(`Удалить файл "${filename}" из сессии "${sessionId}"?`)) {
                await fetchData(`recordings/${sessionId}/${filename}`, { method: 'DELETE' });
                loadRecords(); // Перезагружаем список
            }
        }
    });

    const navLink = document.querySelector('a[href="#call-records"]');
    navLink.addEventListener('click', (e) => {
        // Загружаем только если вкладка еще не была загружена
        if (!recordsListContainer.innerHTML.trim() || recordsListContainer.querySelector('.skeleton-list')) {
            loadRecords();
        }
    });

    // Загружаем, если хэш уже установлен при загрузке страницы
    if (window.location.hash === '#call-records') {
        loadRecords();
    }
}