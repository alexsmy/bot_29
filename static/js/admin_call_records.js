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

// ИСПРАВЛЕНИЕ: Полностью переработанная функция рендеринга для корректной группировки звонков
function renderRecordSession(session) {
    const calls = {};
    const participantFiles = session.files.filter(f => 
        !f.includes('_dialog') && !f.includes('_resume') && f.split('_').length >= 4
    );

    // 1. Группируем файлы участников в звонки по временной близости
    participantFiles.forEach(file => {
        const parts = file.split('_');
        const fileTimestamp = new Date(`${parts[0].slice(0,4)}-${parts[0].slice(4,6)}-${parts[0].slice(6,8)}T${parts[1].slice(0,2)}:${parts[1].slice(2,4)}:${parts[1].slice(4,6)}Z`).getTime();
        const userId = parts[3].split('.')[0];

        let foundCall = false;
        // Ищем существующий звонок, к которому можно отнести этот файл (в пределах 5 секунд)
        for (const callId in calls) {
            if (Math.abs(calls[callId].timestamp - fileTimestamp) < 5000) {
                calls[callId].files.push(file);
                foundCall = true;
                break;
            }
        }

        // Если подходящий звонок не найден, создаем новый
        if (!foundCall) {
            const callId = `${parts[0]}_${parts[1]}`;
            calls[callId] = {
                id: callId,
                timestamp: fileTimestamp,
                files: [file]
            };
        }
    });

    // 2. Рендерим HTML для каждого сгруппированного звонка
    let callsHtml = Object.values(calls).sort((a, b) => b.timestamp - a.timestamp).map(call => {
        const participants = {};
        
        // Распределяем файлы по участникам внутри звонка
        call.files.forEach(file => {
            const parts = file.split('_');
            const userId = parts[3].split('.')[0];
            if (!participants[userId]) {
                participants[userId] = { id: userId, webm: null, txt: null };
            }
            if (file.endsWith('.webm')) participants[userId].webm = file;
            else if (file.endsWith('.txt')) participants[userId].txt = file;
        });

        // Ищем соответствующие файлы диалога и саммари
        const dialogFile = session.files.find(f => f.startsWith(call.id) && f.includes('_dialog.txt'));
        const resumeFile = session.files.find(f => f.startsWith(call.id) && f.includes('_resume.txt'));

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

        const resumeHtml = `
            <div class="record-item-actions">
                <div class="record-item-info" style="min-width: 120px;"><b>Краткий пересказ</b></div>
                ${renderActionGroup('RESUME', resumeFile, !!resumeFile)}
            </div>
        `;

        return `
            <div style="border: 1px solid var(--border-color); border-radius: 6px; padding: 0.5rem 1rem; margin-top: 1rem;">
                <h5 style="margin: 0.5rem 0; font-family: monospace;">Звонок: ${call.id}</h5>
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