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

// ИСПРАВЛЕНИЕ: Полностью переработанная функция рендеринга
function renderRecordSession(session) {
    const calls = {}; // Группируем файлы по звонкам

    // Сначала группируем все файлы по их уникальному timestamp (дата_время)
    session.files.forEach(file => {
        const parts = file.split('_');
        if (parts.length < 4) return; // Пропускаем dialog и resume файлы на этом этапе

        const timestamp = `${parts[0]}_${parts[1]}`;
        const userId = parts[3].split('.')[0];

        if (!calls[timestamp]) {
            calls[timestamp] = { timestamp: timestamp, participants: {} };
        }
        if (!calls[timestamp].participants[userId]) {
            calls[timestamp].participants[userId] = { id: userId, webm: null, txt: null };
        }

        if (file.endsWith('.webm')) {
            calls[timestamp].participants[userId].webm = file;
        } else if (file.endsWith('.txt') && !file.includes('dialog') && !file.includes('resume')) {
            calls[timestamp].participants[userId].txt = file;
        }
    });

    // Ищем файлы диалога и саммари и привязываем их к ближайшему по времени звонку
    session.files.forEach(file => {
        if (file.includes('_dialog.txt') || file.includes('_resume.txt')) {
            const parts = file.split('_');
            const timestamp = `${parts[0]}_${parts[1]}`;
            if (calls[timestamp]) {
                if (file.includes('_dialog.txt')) calls[timestamp].dialogFile = file;
                if (file.includes('_resume.txt')) calls[timestamp].resumeFile = file;
            }
        }
    });

    // Рендерим HTML для каждого звонка
    let callsHtml = Object.values(calls).map(call => {
        let participantsHtml = Object.values(call.participants).map(p => `
            <div class="record-item-actions">
                <div class="record-item-info" style="min-width: 120px;">Участник: ${p.id.substring(0, 8)}...</div>
                ${renderActionGroup('WEBM', p.webm, !!p.webm)}
                ${renderActionGroup('TXT', p.txt, !!p.txt)}
            </div>
        `).join('');

        const dialogHtml = call.dialogFile ? `
            <div class="record-item-actions">
                <div class="record-item-info" style="min-width: 120px;"><b>Общий диалог</b></div>
                ${renderActionGroup('DIALOG', call.dialogFile, true)}
            </div>
        ` : '';

        const resumeHtml = call.resumeFile ? `
            <div class="record-item-actions">
                <div class="record-item-info" style="min-width: 120px;"><b>Краткий пересказ</b></div>
                ${renderActionGroup('RESUME', call.resumeFile, true)}
            </div>
        ` : '';

        return `
            <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem 1rem; margin-top: 1rem;">
                <h5 style="margin: 0.5rem 0; font-family: monospace;">Звонок: ${call.timestamp}</h5>
                ${participantsHtml}
                ${dialogHtml}
                ${resumeHtml}
            </div>
        `;
    }).join('');

    return `
        <div class="record-item" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
            <h4 style="margin: 0.5rem 0; font-family: monospace;">Сессия комнаты: ${session.session_id}</h4>
            ${callsHtml}
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

    if (window.location.hash === '#call-records') {
        loadRecords();
    }
}