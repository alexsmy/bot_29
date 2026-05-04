/**
 * Форматирует URL, оставляя только протокол и домен для краткости.
 * @param {string} urlString - Полный URL.
 * @returns {string} Отформатированный URL.
 */
function formatUrl(urlString) {
    try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.hostname}`;
    } catch (e) {
        return urlString;
    }
}

/**
 * Генерирует HTML для сводной карточки.
 * @param {string} icon - Класс иконки FontAwesome.
 * @param {string} title - Заголовок карточки.
 * @param {string} value - Значение.
 * @param {string} id - ID для элемента со значением.
 * @returns {string} HTML-строка.
 */
function createSummaryCardHTML(icon, title, value, id) {
    return `
        <div class="glass-card rounded-xl p-4 flex items-center gap-4">
            <div class="bg-slate-800/60 w-12 h-12 rounded-lg flex items-center justify-center text-blue-400 text-xl">
                <i class="${icon}"></i>
            </div>
            <div>
                <div class="text-xs text-slate-400 uppercase tracking-wider">${title}</div>
                <div id="${id}" class="text-xl font-bold text-white">${value}</div>
            </div>
        </div>
    `;
}

/**
 * Рендерит и обновляет сводную панель.
 * @param {Array} stats - Массив объектов статистики.
 */
function renderSummary(stats) {
    const container = document.getElementById('summary-panel');
    const onlineCount = stats.filter(s => s.status === 'Онлайн').length;
    const offlineCount = stats.length - onlineCount;
    const totalChecks = stats.reduce((acc, s) => acc + s.success_count + s.fail_count, 0);

    if (!container.innerHTML) {
        container.innerHTML = `
            ${createSummaryCardHTML('fa-solid fa-server', 'Всего сервисов', stats.length, 'summary-total')}
            ${createSummaryCardHTML('fa-solid fa-circle-check', 'Онлайн', onlineCount, 'summary-online')}
            ${createSummaryCardHTML('fa-solid fa-circle-xmark', 'Оффлайн', offlineCount, 'summary-offline')}
            ${createSummaryCardHTML('fa-solid fa-check-double', 'Всего проверок', totalChecks.toLocaleString(), 'summary-checks')}
        `;
    } else {
        document.getElementById('summary-total').innerText = stats.length;
        document.getElementById('summary-online').innerText = onlineCount;
        document.getElementById('summary-offline').innerText = offlineCount;
        document.getElementById('summary-checks').innerText = totalChecks.toLocaleString();
    }
}


/**
 * Генерирует HTML-разметку для карточки сервиса.
 * @param {object} stat - Объект статистики.
 * @returns {string} HTML-строка.
 */
function generateCardHTML(stat) {
    const shortUrl = formatUrl(stat.url);
    return `
        <div class="p-4 flex flex-col h-full">
            <!-- Header -->
            <div class="flex justify-between items-start mb-4">
                <div class="overflow-hidden pr-2">
                    <h2 class="text-base font-bold text-white truncate" title="${stat.name}">${stat.name}</h2>
                    <a href="${stat.url}" target="_blank" class="text-xs text-blue-400 hover:underline truncate block" title="${stat.url}">${shortUrl}</a>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span data-target="status-text" class="text-xs font-semibold"></span>
                    <div data-target="status-indicator" class="status-indicator"></div>
                </div>
            </div>

            <!-- Uptime -->
            <div class="mb-4">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[11px] text-slate-400 uppercase tracking-wider">Uptime</span>
                    <span class="text-sm font-semibold"><span data-target="uptime">0</span>%</span>
                </div>
                <div class="uptime-bar-bg">
                    <div data-target="uptime-bar" class="uptime-bar"></div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-2 gap-2 mt-auto">
                <div class="bg-slate-800/60 p-2 rounded-lg border border-slate-700/30">
                    <div class="text-[10px] text-slate-400 mb-0.5">Отклик</div>
                    <div class="text-sm font-semibold"><span data-target="response-time">...</span> <span class="text-xs text-slate-500">мс</span></div>
                </div>
                <div class="bg-slate-800/60 p-2 rounded-lg border border-slate-700/30">
                    <div class="text-[10px] text-slate-400 mb-0.5">Код ответа</div>
                    <div class="text-sm font-semibold" data-target="status-code">...</div>
                </div>
            </div>

            <!-- Footer -->
            <div class="mt-3 pt-2 border-t border-slate-700/50 text-[10px] text-slate-400 text-center">
                Последняя проверка: <span data-target="last-checked" class="font-medium text-slate-300">...</span>
            </div>
        </div>
    `;
}

/**
 * Обновляет DOM-элементы карточки на основе свежих данных.
 * @param {HTMLElement} card - DOM-элемент карточки.
 * @param {object} stat - Объект статистики.
 */
function updateCardDOM(card, stat) {
    const totalChecks = stat.success_count + stat.fail_count;
    const uptime = totalChecks > 0 ? ((stat.success_count / totalChecks) * 100).toFixed(1) : 0;

    let statusColor, pulseClass, barColor;
    if (stat.status === 'Онлайн') {
        statusColor = 'text-green-400'; pulseClass = 'pulse-green'; barColor = 'bg-green-500';
    } else if (stat.status === 'Оффлайн') {
        statusColor = 'text-red-400'; pulseClass = 'pulse-red'; barColor = 'bg-red-500';
    } else {
        statusColor = 'text-yellow-400'; pulseClass = 'pulse-yellow'; barColor = 'bg-yellow-500';
    }

    const statusTextEl = card.querySelector('[data-target="status-text"]');
    statusTextEl.innerText = stat.status;
    statusTextEl.className = `text-xs font-semibold ${statusColor}`;

    const statusIndEl = card.querySelector('[data-target="status-indicator"]');
    statusIndEl.className = `status-indicator ${pulseClass}`;

    card.querySelector('[data-target="response-time"]').innerText = stat.response_time_ms;
    card.querySelector('[data-target="uptime"]').innerText = uptime;
    card.querySelector('[data-target="status-code"]').innerText = stat.status_code || '-';
    card.querySelector('[data-target="last-checked"]').innerText = stat.last_checked ? stat.last_checked.split(' ')[1] : 'Ожидание...';

    const uptimeBar = card.querySelector('[data-target="uptime-bar"]');
    uptimeBar.style.width = `${uptime}%`;
    uptimeBar.className = `uptime-bar ${barColor}`;
}

/**
 * Основная функция рендеринга. Создает или обновляет карточки.
 * @param {Array} stats - Массив объектов статистики.
 */
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

    renderSummary(stats);

    stats.forEach(stat => {
        const safeId = 'stat-card-' + stat.name.replace(/[^a-zA-Z0-9]/g, '-');
        let card = document.getElementById(safeId);

        if (!card) {
            card = document.createElement('div');
            card.id = safeId;
            card.className = "glass-card rounded-xl shadow-lg transition-transform hover:scale-[1.02] duration-300";
            card.innerHTML = generateCardHTML(stat);
            container.appendChild(card);
        }

        updateCardDOM(card, stat);
    });
}

/**
 * Запрашивает данные с API и запускает рендеринг.
 */
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

// Инициализация и запуск периодического обновления
fetchStats();
setInterval(fetchStats, 60000);