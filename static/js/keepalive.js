function formatUrl(urlString) {
    try {
        const url = new URL(urlString);
        const hostParts = url.hostname.split('.');
        if (hostParts.length > 0) {
            return `${url.protocol}//${hostParts[0]}...`;
        }
        return urlString;
    } catch (e) {
        return urlString;
    }
}

async function fetchStats() {
    try {
        const response = await fetch('/api/stats');
        const data = await response.json();
        renderStats(data.stats);
        document.getElementById('last-sync').innerText = 'Обновлено: ' + new Date().toLocaleTimeString();
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        document.getElementById('last-sync').innerText = 'Ошибка соединения';
    }
}

function generateCardHTML(stat, shortUrl) {
    return `
        <div class="flex justify-between items-start mb-3">
            <div class="overflow-hidden pr-2">
                <h2 class="text-lg font-bold text-white truncate" title="${stat.name}">${stat.name}</h2>
                <a href="${stat.url}" target="_blank" class="text-xs text-blue-400 hover:underline truncate block mt-0.5" title="${stat.url}">${shortUrl}</a>
            </div>
            <div class="flex items-center gap-2 shrink-0 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/50">
                <span data-target="status-text" class="text-xs font-semibold"></span>
                <div data-target="status-indicator" class="w-2.5 h-2.5 rounded-full"></div>
            </div>
        </div>

        <div class="grid grid-cols-2 gap-2 mt-auto">
            <div class="bg-slate-800/60 p-2.5 rounded-lg flex flex-col justify-center border border-slate-700/30">
                <div class="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider"><i class="fa-solid fa-stopwatch mr-1"></i>Отклик</div>
                <div class="text-sm font-semibold"><span data-target="response-time"></span> <span class="text-[10px] font-normal text-slate-500">мс</span></div>
            </div>
            <div class="bg-slate-800/60 p-2.5 rounded-lg flex flex-col justify-center border border-slate-700/30">
                <div class="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider"><i class="fa-solid fa-chart-line mr-1"></i>Uptime</div>
                <div class="text-sm font-semibold"><span data-target="uptime"></span> <span class="text-[10px] font-normal text-slate-500">%</span></div>
            </div>
            <div class="bg-slate-800/60 p-2.5 rounded-lg flex flex-col justify-center border border-slate-700/30">
                <div class="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider"><i class="fa-solid fa-server mr-1"></i>Код</div>
                <div class="text-sm font-semibold" data-target="status-code"></div>
            </div>
            <div class="bg-slate-800/60 p-2.5 rounded-lg flex flex-col justify-center border border-slate-700/30">
                <div class="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider"><i class="fa-solid fa-check-double mr-1"></i>Проверок</div>
                <div class="text-sm font-semibold" data-target="total-checks"></div>
            </div>
        </div>

        <div class="mt-3 pt-2 border-t border-slate-700/50 text-[10px] text-slate-400 flex justify-between items-center">
            <span>Последняя проверка:</span>
            <span data-target="last-checked" class="bg-slate-800 px-2 py-0.5 rounded text-slate-300"></span>
        </div>
    `;
}

function updateCardDOM(card, stat) {
    const totalChecks = stat.success_count + stat.fail_count;
    const uptime = totalChecks > 0 ? ((stat.success_count / totalChecks) * 100).toFixed(1) : 0;

    let statusColor, pulseClass;
    if (stat.status === 'Онлайн') {
        statusColor = 'text-green-400'; pulseClass = 'pulse-green bg-green-500';
    } else if (stat.status === 'Оффлайн') {
        statusColor = 'text-red-400'; pulseClass = 'pulse-red bg-red-500';
    } else {
        statusColor = 'text-yellow-400'; pulseClass = 'pulse-yellow bg-yellow-500';
    }

    const statusTextEl = card.querySelector('[data-target="status-text"]');
    if (statusTextEl.innerText !== stat.status) {
        statusTextEl.innerText = stat.status;
        statusTextEl.className = `text-xs font-semibold ${statusColor}`;
    }

    const statusIndEl = card.querySelector('[data-target="status-indicator"]');
    statusIndEl.className = `w-2.5 h-2.5 rounded-full ${pulseClass}`;

    card.querySelector('[data-target="response-time"]').innerText = stat.response_time_ms;
    card.querySelector('[data-target="uptime"]').innerText = uptime;
    card.querySelector('[data-target="status-code"]').innerText = stat.status_code || '-';
    card.querySelector('[data-target="total-checks"]').innerText = totalChecks;
    card.querySelector('[data-target="last-checked"]').innerText = stat.last_checked || 'Ожидание...';
}

function renderStats(stats) {
    const container = document.getElementById('stats-container');

    if (stats.length === 0) {
        if (!document.getElementById('empty-msg')) {
            container.innerHTML = '<div id="empty-msg" class="col-span-full text-center text-slate-500 py-10 bg-slate-800/30 rounded-xl border border-slate-700/50">Нет данных для отображения. Ожидание инициализации...</div>';
        }
        return;
    }

    const emptyMsg = document.getElementById('empty-msg');
    if (emptyMsg) emptyMsg.remove();

    stats.forEach(stat => {
        const safeId = 'stat-card-' + stat.name.replace(/[^a-zA-Z0-9]/g, '-');
        let card = document.getElementById(safeId);

        if (!card) {
            const shortUrl = formatUrl(stat.url);
            card = document.createElement('div');
            card.id = safeId;
            card.className = "glass-card rounded-xl p-4 shadow-lg transition-transform hover:scale-[1.01] duration-300 flex flex-col h-full";
            card.innerHTML = generateCardHTML(stat, shortUrl);
            container.appendChild(card);
        }

        updateCardDOM(card, stat);
    });
}

fetchStats();
setInterval(fetchStats, 60000);