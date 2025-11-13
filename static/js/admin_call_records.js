// bot_29-main/static/js/admin_call_records.js

import { fetchData } from './admin_api.js';

let recordsListContainer, modalOverlay, modalTitle, modalBody, modalCloseBtn;
const API_TOKEN = document.body.dataset.token;

function renderFileRow(fileType, filename, fileLabel) {
    if (!filename) return '';

    return `
        <div class="record-file-row">
            <div class="record-file-info">
                <span class="file-type-badge">${fileType}</span>
                <span>${fileLabel}</span>
            </div>
            <div class="record-file-actions">
                ${fileType !== 'WEBM' ? `<button class="icon-btn" data-action="read" data-filename="${filename}" title="Просмотреть">${ICONS.read}</button>` : ''}
                ${fileType === 'WEBM' ? `<button class="icon-btn" data-action="play" data-filename="${filename}" title="Воспроизвести">${ICONS.play}</button>` : ''}
                <a href="/api/admin/recordings/${filename}?token=${API_TOKEN}" class="icon-btn" title="Скачать">${ICONS.download}</a>
                <button class="icon-btn danger" data-action="delete" data-filename="${filename}" title="Удалить">${ICONS.delete}</button>
            </div>
        </div>
    `;
}

function renderRecordSession(session) {
    const participants = {};
    let dialogFile = null;
    let resumeFile = null;

    session.files.sort();

    session.files.forEach(file => {
        if (file.includes('_dialog.txt')) {
            dialogFile = file;
            return;
        }
        if (file.includes('_resume.txt')) {
            resumeFile = file;
            return;
        }
        
        const parts = file.split('_');
        // ИСПРАВЛЕНИЕ: ID участника находится на 4-й позиции (индекс 3)
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
        ${renderFileRow('WEBM', p.webm, `Участник ${p.id.substring(0, 8)}...`)}
        ${renderFileRow('TXT', p.txt, `Транскрибация ${p.id.substring(0, 8)}...`)}
    `).join('');

    return `
        <div class="record-session-card">
            <h4>Сессия: ${session.session_id}</h4>
            ${participantsHtml}
            ${renderFileRow('DIALOG', dialogFile, 'Общий диалог')}
            ${renderFileRow('RESUME', resumeFile, 'Краткий пересказ')}
        </div>
    `;
}

async function loadRecords() {
    recordsListContainer.innerHTML = '<div class="skeleton-list"></div>';
    const sessions = await fetchData('recordings');
    if (sessions && sessions.length > 0) {
        recordsListContainer.innerHTML = sessions.map(renderRecordSession).join('');
    } else {
        recordsListContainer.innerHTML = '<p class="empty-list">Записи не найдены.</p>';
    }
}

function showModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    modalOverlay.classList.add('visible');
}

function hideModal() {
    modalOverlay.classList.remove('visible');
    modalBody.innerHTML = ''; // Очищаем содержимое, чтобы остановить воспроизведение
}

async function handleRead(filename) {
    const content = await fetchData(`recordings/${filename}`);
    showModal(`Просмотр: ${filename}`, `<pre>${content}</pre>`);
}

function handlePlay(filename) {
    const audioUrl = `/api/admin/recordings/${filename}?token=${API_TOKEN}`;
    showModal(`Воспроизведение: ${filename}`, `<audio controls autoplay src="${audioUrl}">Ваш браузер не поддерживает аудио.</audio>`);
}

export function initCallRecords() {
    recordsListContainer = document.getElementById('call-records-list');
    modalOverlay = document.getElementById('viewer-modal');
    modalTitle = document.getElementById('modal-title');
    modalBody = document.getElementById('modal-body');
    modalCloseBtn = document.getElementById('modal-close-btn');

    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay || e.target === modalCloseBtn || e.target.closest('#modal-close-btn')) {
            hideModal();
        }
    });

    recordsListContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('.icon-btn');
        if (!button) return;

        const action = button.dataset.action;
        const filename = button.dataset.filename;

        if (action === 'delete') {
            if (confirm(`Удалить файл "${filename}"?`)) {
                await fetchData(`recordings/${filename}`, { method: 'DELETE' });
                loadRecords();
            }
        } else if (action === 'read') {
            handleRead(filename);
        } else if (action === 'play') {
            handlePlay(filename);
        }
    });

    const navLink = document.querySelector('a[href="#call-records"]');
    navLink.addEventListener('click', loadRecords);

    if (window.location.hash === '#call-records') {
        loadRecords();
    }
}