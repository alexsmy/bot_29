// bot_29-main/static/js/admin_call_records.js

import { fetchData } from './admin_api.js';

let recordsListContainer;
const API_TOKEN = document.body.dataset.token;

function renderRecordItem(record) {
    const webmFilename = `${record.name}.webm`;
    const txtFilename = `${record.name}.txt`;

    const webmButtons = record.has_webm ? `
        <button class="action-btn" onclick="window.location.href='/api/admin/recordings/${webmFilename}?token=${API_TOKEN}'">Скачать</button>
        <button class="action-btn danger" data-filename="${webmFilename}">Удалить</button>
    ` : `<button class="action-btn disabled" disabled>Нет файла</button>`;

    const txtButtons = record.has_txt ? `
        <button class="action-btn" onclick="window.location.href='/api/admin/recordings/${txtFilename}?token=${API_TOKEN}'">Скачать</button>
        <button class="action-btn danger" data-filename="${txtFilename}">Удалить</button>
    ` : `<button class="action-btn disabled" disabled>Нет файла</button>`;

    return `
        <div class="record-item">
            <div class="record-item-info">${record.name}</div>
            <div class="record-item-actions">
                <div class="action-group">
                    <span class="file-type">WEBM</span>
                    ${webmButtons}
                </div>
                <div class="action-group">
                    <span class="file-type">TXT</span>
                    ${txtButtons}
                </div>
            </div>
        </div>
    `;
}

async function loadRecords() {
    const records = await fetchData('recordings');
    if (records && records.length > 0) {
        recordsListContainer.innerHTML = records.map(renderRecordItem).join('');
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