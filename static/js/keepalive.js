
import {
    loadSettings,
    renderSettings,
    openSettingsModal,
    closeSettingsModal,
    collectSettingsPayload,
    saveSettings,
    addTargetRow
} from './modules/settings-modal.js';

function formatUrl(urlString) {
    try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.hostname}`;
    } catch {
        return urlString;
    }
}

function createSummaryCardHTML(icon, title, value, id) {
    return `
        <div class="glass-card rounded-3xl p-4 flex items-center gap-4">
            <div class="bg-slate-900/70 w-12 h-12 rounded-2xl flex items-center justify-center text-cyan-300 text-xl">
                <i class="${icon}"></i>
            </div>
            <div>
                <div class="text-xs text-slate-400 uppercase tracking-wider">${title}</div>
                <div id="${id}" class="text-xl font-bold text-white">${value}</div>
            </div>
        </div>
    `;
}

function renderSummary(stats) {
    const container = document.getElementById('summary-panel');
    const onlineCount = stats.filter(s => s.status === 'Онлайн').length;
    const totalChecks = stats.reduce((acc, s) => acc + s.success_count + s.fail_count, 0);

    container.innerHTML = `
        ${createSummaryCardHTML('fa-solid fa-server', 'Всего сервисов', stats.length, 'summary-total')}
        ${createSummaryCardHTML('fa-solid fa-circle-check', 'Онлайн', onlineCount, 'summary-online')}
        ${createSummaryCardHTML('fa-solid fa-circle-xmark', 'Оффлайн', stats.length - onlineCount, 'summary-offline')}
        ${createSummaryCardHTML('fa-solid fa-check-double', 'Всего проверок', totalChecks.toLocaleString(), 'summary-checks')}
    `;
}

function generateCardHTML(stat) {
    const shortUrl = formatUrl(stat.url);

    return `
        <div class="p-5 flex flex-col h-full">
            <div class="flex justify-between items-start mb-5">
                <div class="overflow-hidden pr-3">
                    <h2 class="text-lg font-bold text-white truncate">${stat.name}</h2>
                    <a href="${stat.url}" target="_blank" class="text-xs text-cyan-300 hover:underline truncate block mt-1">${shortUrl}</a>
                </div>

                <div class="flex items-center gap-2">
                    <span data-target="status-text"></span>
                    <div data-target="status-indicator" class="status-indicator"></div>
                </div>
            </div>

            <div class="mb-5">
                <div class="flex justify-between text-sm mb-2">
                    <span class="text-slate-400">Uptime</span>
                    <span><span data-target="uptime"></span>%</span>
                </div>

                <div class="uptime-bar-bg">
                    <div data-target="uptime-bar" class="uptime-bar"></div>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 mt-auto">
                <div class="bg-slate-950/40 rounded-2xl border border-slate-700/40 p-3">
                    <div class="text-xs text-slate-400">Отклик</div>
                    <div class="text-lg font-semibold mt-1">
                        <span data-target="response-time"></span> мс
                    </div>
                </div>

                <div class="bg-slate-950/40 rounded-2xl border border-slate-700/40 p-3">
                    <div class="text-xs text-slate-400">Код ответа</div>
                    <div class="text-lg font-semibold mt-1" data-target="status-code"></div>
                </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                Последняя проверка:
                <span data-target="last-checked" class="text-slate-200"></span>
            </div>
        </div>
    `;
}

function updateCardDOM(card, stat) {
    const totalChecks = stat.success_count + stat.fail_count;
    const uptime = totalChecks > 0 ? ((stat.success_count / totalChecks) * 100).toFixed(1) : 0;

    const statusMap = {
        'Онлайн': ['text-green-400', 'pulse-green', 'bg-green-500'],
        'Оффлайн': ['text-red-400', 'pulse-red', 'bg-red-500']
    };

    const [statusColor, pulseClass, barColor] = statusMap[stat.status] || ['text-yellow-400', 'pulse-yellow', 'bg-yellow-500'];

    card.querySelector('[data-target="status-text"]').className = `text-sm font-semibold ${statusColor}`;
    card.querySelector('[data-target="status-text"]').innerText = stat.status;
    card.querySelector('[data-target="status-indicator"]').className = `status-indicator ${pulseClass}`;
    card.querySelector('[data-target="response-time"]').innerText = stat.response_time_ms;
    card.querySelector('[data-target="status-code"]').innerText = stat.status_code || '-';
    card.querySelector('[data-target="last-checked"]').innerText = stat.last_checked || 'Ожидание';
    card.querySelector('[data-target="uptime"]').innerText = uptime;

    const bar = card.querySelector('[data-target="uptime-bar"]');
    bar.style.width = `${uptime}%`;
    bar.className = `uptime-bar ${barColor}`;
}

function renderStats(stats) {
    renderSummary(stats);

    const container = document.getElementById('stats-container');
    container.innerHTML = '';

    stats.forEach((stat) => {
        const card = document.createElement('div');
        card.className = 'glass-card';
        card.innerHTML = generateCardHTML(stat);

        updateCardDOM(card, stat);
        container.appendChild(card);
    });
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();

        renderStats(data.stats);
        document.getElementById('last-sync').innerText = `Обновлено: ${new Date().toLocaleTimeString()}`;
    } catch (error) {
        console.error(error);
        document.getElementById('last-sync').innerText = 'Ошибка соединения';
    }
}

document.getElementById('open-settings-btn').addEventListener('click', async () => {
    const config = await loadSettings();
    renderSettings(config);
    openSettingsModal();
});

document.getElementById('close-settings-btn').addEventListener('click', closeSettingsModal);

document.getElementById('add-target-btn').addEventListener('click', addTargetRow);

document.getElementById('save-settings-btn').addEventListener('click', async () => {
    const payload = collectSettingsPayload();
    await saveSettings(payload);

    closeSettingsModal();
    await fetchStats();
});

fetchStats();
setInterval(fetchStats, 60000);
