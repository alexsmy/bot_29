import { formatLocalTime } from './time-format.js';
import { formatRefreshLabel } from './refresh-controller.js';

function formatUrl(urlString) {
    try {
        const url = new URL(urlString);
        return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}`;
    } catch (error) {
        return urlString;
    }
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function createSummaryCardHTML(icon, title, value, id) {
    return `
        <div class="summary-card glass-card">
            <div class="summary-icon">
                <i class="${icon}"></i>
            </div>
            <div class="summary-copy">
                <div class="summary-label">${title}</div>
                <div id="${id}" class="summary-value">${value}</div>
            </div>
        </div>
    `;
}

function ensureSummaryPanel(stats) {
    const container = document.getElementById('summary-panel');
    if (!container) {
        return;
    }

    const onlineCount = stats.filter((stat) => stat.status === 'Онлайн').length;
    const offlineCount = stats.length - onlineCount;
    const totalChecks = stats.reduce((accumulator, stat) => accumulator + (stat.success_count || 0) + (stat.fail_count || 0), 0);

    if (!container.dataset.initialized) {
        container.dataset.initialized = 'true';
        container.innerHTML = `
            ${createSummaryCardHTML('fa-solid fa-server', 'Всего сервисов', stats.length, 'summary-total')}
            ${createSummaryCardHTML('fa-solid fa-circle-check', 'Онлайн', onlineCount, 'summary-online')}
            ${createSummaryCardHTML('fa-solid fa-circle-xmark', 'Оффлайн', offlineCount, 'summary-offline')}
            ${createSummaryCardHTML('fa-solid fa-check-double', 'Всего проверок', totalChecks.toLocaleString('ru-RU'), 'summary-checks')}
        `;
        return;
    }

    const totalEl = document.getElementById('summary-total');
    const onlineEl = document.getElementById('summary-online');
    const offlineEl = document.getElementById('summary-offline');
    const checksEl = document.getElementById('summary-checks');

    if (totalEl) totalEl.innerText = stats.length;
    if (onlineEl) onlineEl.innerText = onlineCount;
    if (offlineEl) offlineEl.innerText = offlineCount;
    if (checksEl) checksEl.innerText = totalChecks.toLocaleString('ru-RU');
}

function getCardId(stat) {
    const base = stat.id || `${stat.name || 'service'}-${stat.url || ''}`;
    return `stat-card-${String(base).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function generateCardHTML(stat) {
    const shortUrl = formatUrl(stat.url);
    return `
        <div class="service-card-inner">
            <div class="service-card-header">
                <div class="service-card-heading">
                    <h2 title="${escapeHtml(stat.name)}">${escapeHtml(stat.name)}</h2>
                    <a href="${escapeHtml(stat.url)}" target="_blank" rel="noreferrer" title="${escapeHtml(stat.url)}">${escapeHtml(shortUrl)}</a>
                </div>
                <div class="service-status-wrap">
                    <span data-target="status-text" class="service-status-text"></span>
                    <div data-target="status-indicator" class="status-indicator"></div>
                </div>
            </div>

            <div class="service-stats-grid">
                <div class="stat-chip stat-chip--uptime">
                    <div class="stat-chip-label">Uptime</div>
                    <div class="stat-chip-value"><span data-target="uptime">0</span><span class="stat-chip-unit">%</span></div>
                    <div class="uptime-bar-bg">
                        <div data-target="uptime-bar" class="uptime-bar"></div>
                    </div>
                </div>
                <div class="stat-chip">
                    <div class="stat-chip-label">Отклик</div>
                    <div class="stat-chip-value"><span data-target="response-time">...</span> <span class="stat-chip-unit">мс</span></div>
                </div>
                <div class="stat-chip">
                    <div class="stat-chip-label">Код ответа</div>
                    <div class="stat-chip-value" data-target="status-code">...</div>
                </div>
            </div>

            <div class="service-footer">
                Последняя проверка: <span data-target="last-checked" class="service-footer-value">...</span>
            </div>
        </div>
    `;
}

function updateCardDOM(card, stat) {
    const totalChecks = (stat.success_count || 0) + (stat.fail_count || 0);
    const uptime = totalChecks > 0 ? ((stat.success_count / totalChecks) * 100).toFixed(1) : '0.0';

    let statusColor = 'service-status-wait';
    let pulseClass = 'pulse-yellow';
    let barClass = 'uptime-bar--waiting';

    if (stat.status === 'Онлайн') {
        statusColor = 'service-status-online';
        pulseClass = 'pulse-green';
        barClass = 'uptime-bar--online';
    } else if (stat.status === 'Оффлайн') {
        statusColor = 'service-status-offline';
        pulseClass = 'pulse-red';
        barClass = 'uptime-bar--offline';
    }

    const statusTextEl = card.querySelector('[data-target="status-text"]');
    if (statusTextEl) {
        statusTextEl.innerText = stat.status || 'Ожидание...';
        statusTextEl.className = `service-status-text ${statusColor}`;
    }

    const statusIndEl = card.querySelector('[data-target="status-indicator"]');
    if (statusIndEl) {
        statusIndEl.className = `status-indicator ${pulseClass}`;
    }

    const responseTimeEl = card.querySelector('[data-target="response-time"]');
    if (responseTimeEl) responseTimeEl.innerText = stat.response_time_ms ?? 0;

    const uptimeEl = card.querySelector('[data-target="uptime"]');
    if (uptimeEl) uptimeEl.innerText = uptime;

    const statusCodeEl = card.querySelector('[data-target="status-code"]');
    if (statusCodeEl) statusCodeEl.innerText = stat.status_code || '-';

    const lastCheckedEl = card.querySelector('[data-target="last-checked"]');
    if (lastCheckedEl) {
        lastCheckedEl.innerText = formatLocalTime(stat.last_checked_iso || stat.last_checked);
    }

    const uptimeBar = card.querySelector('[data-target="uptime-bar"]');
    if (uptimeBar) {
        uptimeBar.style.width = `${uptime}%`;
        uptimeBar.className = `uptime-bar ${barClass}`;
    }
}

function renderEmptyState(container) {
    if (!document.getElementById('empty-msg')) {
        container.innerHTML = '<div id="empty-msg" class="empty-state glass-card">Нет данных для отображения. Ожидание инициализации...</div>';
    }
}

// FIX 1: Optimize DOM rendering with batching and caching
export function renderStats(stats) {
    const container = document.getElementById('stats-container');
    if (!container) {
        return;
    }

    if (!Array.isArray(stats) || stats.length === 0) {
        renderEmptyState(container);
        ensureSummaryPanel([]);
        return;
    }

    const emptyMsg = document.getElementById('empty-msg');
    if (emptyMsg) {
        emptyMsg.remove();
    }

    ensureSummaryPanel(stats);

    const activeIds = new Set();
    const existingCardsMap = new Map();
    
    // Build map of existing cards for O(1) lookup
    Array.from(container.children).forEach((child) => {
        if (child.id) {
            existingCardsMap.set(child.id, child);
        }
    });

    const cardsToAppend = [];

    // Process all stats and batch DOM updates
    stats.forEach((stat) => {
        const cardId = getCardId(stat);
        activeIds.add(cardId);

        let card = existingCardsMap.get(cardId);
        if (!card) {
            card = document.createElement('div');
            card.id = cardId;
            card.className = 'glass-card service-card';
            card.innerHTML = generateCardHTML(stat);
            cardsToAppend.push(card);
        } else {
            existingCardsMap.delete(cardId); // Mark as processed
        }

        updateCardDOM(card, stat);
    });

    // Batch append new cards at once instead of one by one
    cardsToAppend.forEach((card) => {
        container.appendChild(card);
    });

    // Remove cards that are no longer in stats
    existingCardsMap.forEach((card) => {
        card.remove();
    });
}

export function updateLastSync(text, isError = false) {
    const lastSync = document.getElementById('last-sync');
    if (!lastSync) return;
    lastSync.textContent = text;
    lastSync.dataset.state = isError ? 'error' : 'ok';
}

export function setConnectionHint(text) {
    const el = document.getElementById('connection-hint');
    if (el) {
        el.textContent = text;
    }
}

export function updateRefreshIntervalLabel(seconds) {
    const el = document.getElementById('refresh-interval-label');
    if (el) {
        el.textContent = formatRefreshLabel(seconds);
    }
}
