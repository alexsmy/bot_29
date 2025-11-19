// static/js/admin_database.js

import { fetchData } from './admin_api.js';
import { formatDate } from './admin_utils.js';

let tableSelect, dbViewerContainer, refreshBtn;

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

function renderTableData(data) {
    if (!data || data.length === 0) {
        dbViewerContainer.innerHTML = '<p class="empty-list">Таблица пуста или данные не найдены.</p>';
        return;
    }

    const columns = Object.keys(data[0]);
    
    let html = '<div class="db-table-wrapper"><table><thead><tr>';
    columns.forEach(col => {
        html += `<th>${col}</th>`;
    });
    html += '</tr></thead><tbody>';

    data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
            let val = row[col];
            if (val === null) val = '<span class="null-val">NULL</span>';
            else if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE';
            else if (typeof val === 'object') val = JSON.stringify(val);
            // Простая эвристика для дат (ISO string)
            else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
                val = formatDate(val);
            }
            
            html += `<td>${val}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table></div>';
    dbViewerContainer.innerHTML = html;
}

async function loadTableContent() {
    const tableName = tableSelect.value;
    if (!tableName) return;

    dbViewerContainer.innerHTML = '<div class="skeleton-list"></div>';
    const data = await fetchData(`database/table/${tableName}`);
    renderTableData(data);
}

export function initDatabase() {
    tableSelect = document.getElementById('db-table-select');
    dbViewerContainer = document.getElementById('db-viewer-container');
    refreshBtn = document.getElementById('refresh-db-btn');

    loadTables();

    tableSelect.addEventListener('change', loadTableContent);
    refreshBtn.addEventListener('click', loadTableContent);
}