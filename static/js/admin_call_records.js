import { fetchData } from './admin_api.js';

let recordsListContainer;
const API_TOKEN = document.body.dataset.token;

async function loadRecords() {
    const files = await fetchData('recordings');
    if (files && files.length > 0) {
        recordsListContainer.innerHTML = files.map(filename => `
            <div class="report-item">
                <span>${filename}</span>
                <div class="report-actions">
                    <button class="action-btn" onclick="window.location.href='/api/admin/recordings/${filename}?token=${API_TOKEN}'">Скачать</button>
                    <button class="action-btn danger" data-filename="${filename}">Удалить</button>
                </div>
            </div>
        `).join('');
    } else {
        recordsListContainer.innerHTML = '<p class="empty-list">Записи не найдены.</p>';
    }
}

export function initCallRecords() {
    recordsListContainer = document.getElementById('call-records-list');

    recordsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('danger') && e.target.dataset.filename) {
            const filename = e.target.dataset.filename;
            if (confirm(`Удалить запись "${filename}"?`)) {
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