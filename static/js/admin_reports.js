
// static/js/admin_reports.js

// Этот модуль отвечает за логику раздела "Отчёты".

import { fetchData } from './admin_api.js';

let reportsListContainer, deleteAllReportsBtn;

async function loadReports() {
    const files = await fetchData('reports');
    if (files && files.length > 0) {
        reportsListContainer.innerHTML = files.map(filename => `
            <div class="report-item">
                <a href="/admin/reports/${filename}?token=${window.ADMIN_API_TOKEN}" target="_blank">${filename}</a>
                <div class="report-actions">
                    <button class="action-btn" onclick="window.location.href='/admin/reports/${filename}?download=true&token=${window.ADMIN_API_TOKEN}'">Скачать</button>
                    <button class="action-btn danger" data-filename="${filename}">Удалить</button>
                </div>
            </div>
        `).join('');
    } else {
        reportsListContainer.innerHTML = '<p class="empty-list">Отчёты не найдены.</p>';
    }
}

export function initReports() {
    reportsListContainer = document.getElementById('reports-list');
    deleteAllReportsBtn = document.getElementById('delete-all-reports-btn');

    reportsListContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('danger') && e.target.dataset.filename) {
            const filename = e.target.dataset.filename;
            if (confirm(`Удалить отчёт "${filename}"?`)) {
                await fetchData(`reports/${filename}`, { method: 'DELETE' });
                loadReports();
            }
        }
    });
    
    deleteAllReportsBtn.addEventListener('click', async () => {
        if (confirm('Вы уверены, что хотите удалить ВСЕ отчёты?')) {
            await fetchData('reports', { method: 'DELETE' });
            loadReports();
        }
    });

    loadReports();
}