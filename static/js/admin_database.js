// static/js/admin_database.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let tableSelect, dbViewerContainer, refreshBtn;
let currentPage = 1;
let currentLimit = 100;
let currentTotal = 0;

async function loadTables() {
    const data = await fetchData('database/tables');
    if (data && data.tables) {
        tableSelect.innerHTML = '<option value="" disabled selected>Выберите таблицу</option>';
        data.tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            tableSelect.appendChild(option);
        });
    }
}

function renderTableData(data, total, page, limit) {
    if (!data || data.length === 0) {
        dbViewerContainer.innerHTML = '<p class="empty-list">Таблица пуста или данные не найдены.</p>';
        return;
    }

    const columns = Object.keys(data[0]);
    
    // Формируем таблицу
    let html = '<div class="db-table-wrapper"><table><thead><tr>';
    html += '<th>#</th>'; // Колонка для номера строки
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    const startRowIndex = (page - 1) * limit + 1;

    data.forEach((row, index) => {
        html += '<tr>';
        // Сквозной номер строки
        html += `<td>${startRowIndex + index}</td>`;
        
        columns.forEach(col => {
            let val = row[col];
            if (val === null) val = '<span class="null-val">NULL</span>';
            else if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE';
            else if (typeof val === 'object') val = JSON.stringify(val);
            else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
                val = formatDate(val);
            }
            
            html += `<td>${val}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';

    // Панель пагинации
    const totalPages = Math.ceil(total / limit);
    const endRowIndex = Math.min(startRowIndex + data.length - 1, total);
    
    const paginationHtml = `
        <div class="db-pagination">
            <div class="db-pagination-info">
                Показано <strong>${startRowIndex}-${endRowIndex}</strong> из <strong>${total}</strong> записей
            </div>
            <div class="db-pagination-controls">
                <button class="action-btn" id="db-prev-btn" ${page <= 1 ? 'disabled' : ''}>&larr; Назад</button>
                <span style="display:flex; align-items:center; font-size:0.9em; color:var(--text-secondary);">Стр. ${page} из ${totalPages}</span>
                <button class="action-btn" id="db-next-btn" ${page >= totalPages ? 'disabled' : ''}>Вперед &rarr;</button>
            </div>
        </div>
    `;

    dbViewerContainer.innerHTML = html + paginationHtml;

    // Навешиваем обработчики на кнопки пагинации
    document.getElementById('db-prev-btn')?.addEventListener('click', () => changePage(page - 1));
    document.getElementById('db-next-btn')?.addEventListener('click', () => changePage(page + 1));
}

async function changePage(newPage) {
    currentPage = newPage;
    await loadTableContent();
}

async function loadTableContent() {
    const tableName = tableSelect.value;
    if (!tableName) return;

    dbViewerContainer.innerHTML = '<div class="skeleton-list"></div>';
    
    const response = await fetchData(`database/table/${tableName}?page=${currentPage}&limit=${currentLimit}`);
    
    if (response && response.data) {
        currentTotal = response.total;
        renderTableData(response.data, response.total, response.page, response.limit);
    } else {
        dbViewerContainer.innerHTML = '<p class="empty-list">Ошибка загрузки данных.</p>';
    }
}

export function initDatabase() {
    tableSelect = document.getElementById('db-table-select');
    dbViewerContainer = document.getElementById('db-viewer-container');
    refreshBtn = document.getElementById('refresh-db-btn');

    loadTables();

    tableSelect.addEventListener('change', () => {
        currentPage = 1; // Сброс на первую страницу при выборе новой таблицы
        loadTableContent();
    });
    
    refreshBtn.addEventListener('click', loadTableContent);
}