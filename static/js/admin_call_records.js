
// bot_29-main/static/js/admin_call_records.js

import { fetchData } from './admin_api.js';

let recordsListContainer;
const API_TOKEN = document.body.dataset.token;

function renderActionGroup(fileType, filename, isAvailable) {
    const buttons = isAvailable ? `
        <button class="action-btn" onclick="window.location.href='/api/admin/recordings/${filename}?token=${API_TOKEN}'">Скачать</button>
        <button class="action-btn danger" data-filename="${filename}">Удалить</button>
    ` : `<button class="action-btn disabled" disabled>Нет файла</button>`;

    return `
        <div class="action-group">
            <span class="file-type">${fileType}</span>
            ${buttons}
        </div>
    `;
}

function renderRecordSession(session) {
    const participants = {};
    let dialogFile = null;

    // Сортируем файлы, чтобы участники отображались в одном порядке
    session.files.sort();

    session.files.forEach(file => {
        if (file.includes('_dialog.txt')) {
            dialogFile = file;
            return;
        }
        
        const parts = file.split('_');
        // Имя файла участника: YYYYMMDD_HHMMSS_roomid_userid.ext
        if (parts.length < 4) return; 
        
        const participantId = parts[3].split('.')[0];
        if (!participants[participantId]) {
            participants[participantId] = { id: participantId, webm: null, txt: null };
        }

        if (file.endsWith('.webm')) {
            participants[participantId].webm = file;
        } else if (file.endsWith('.txt')) {
            participants[participantId].txt = file;
        }
    });

    let participantsHtml = Object.values(participants).map(p => `
        <div class="record-item-actions">
            <div class="record-item-info" style="min-width: 120px;">Участник: ${p.id.substring(0, 8)}...</div>
            ${renderActionGroup('WEBM', p.webm, !!p.webm)}
            ${renderActionGroup('TXT', p.txt, !!p.txt)}
        </div>
    `).join('');

    const dialogHtml = `
        <div class="record-item-actions">
            <div class="record-item-info" style="min-width: 120px;"><b>Общий диалог</b></div>
            ${renderActionGroup('DIALOG', dialogFile, !!dialogFile)}
        </div>
    `;

    return `
        <div class="record-item" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
            <h4 style="margin: 0.5rem 0; font-family: monospace;">Сессия: ${session.session_id}</h4>
            ${participantsHtml}
            ${dialogFile ? dialogHtml : ''}
        </div>
    `;
}


async function loadRecords() {
    const sessions = await fetchData('recordings');
    if (sessions && sessions.length > 0) {
        recordsListContainer.innerHTML = sessions.map(renderRecordSession).join('');
    } else {
        recordsListContainer.innerHTML = '<p class="empty-list">Записи не найдены.</p>';
    }
}

export function initCallRecords() {
    recordsListContainer = document.getElementById('call-records-list');

    recordsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('danger') && e.target.dataset.filename) {
            const filename = e.target.dataset.filename;
            if (confirm(`Удалить файл "${filename}"?`)) {
                await fetchData(`recordings/${filename}`, { method: 'DELETE' });
                loadRecords();
            }
        }
    });

    const navLink = document.querySelector('a[href="#call-records"]');
    navLink.addEventListener('click', loadRecords);

    // Загружаем принудительно, если хэш уже установлен при загрузке страницы
    if (window.location.hash === '#call-records') {
        loadRecords();
    }
}