import { projects } from './data/projects.js';
import { createCardHTML } from './components/card.js';
import { renderBackground, renderHeader } from './components/layout.js';
import { statusService } from './services/status.js';

/**
 * Рендерит индикатор статуса на основе общего состояния сервисов.
 * @param {string} status - 'operational', 'degraded', 'offline', 'unknown'
 * @returns {string} HTML-строка индикатора.
 */
function createStatusIndicatorHTML(status) {
    const statusMap = {
        operational: { text: 'Все системы в норме', color: 'green', pulse: true },
        degraded: { text: 'Частичные сбои', color: 'yellow', pulse: true },
        offline: { text: 'Сервис недоступен', color: 'red', pulse: true },
        unknown: { text: 'Статус неизвестен', color: 'gray', pulse: false }
    };

    const { text, color, pulse } = statusMap[status] || statusMap.unknown;
    const pulseClass = pulse ? `animate-pulse` : '';

    return `
        <div class="flex items-center gap-2" title="${text}">
            <span class="text-xs font-semibold text-${color}-400 hidden sm:inline">${text}</span>
            <div class="w-3 h-3 rounded-full bg-${color}-500 ${pulseClass}"></div>
        </div>
    `;
}

/**
 * Асинхронно обновляет карточки проектов, для которых требуется статус.
 */
async function updateProjectStatuses() {
    const projectsWithStatus = projects.filter(p => p.hasStatus);
    if (projectsWithStatus.length === 0) return;

    const overallStatus = await statusService.getOverallStatus();

    projectsWithStatus.forEach(project => {
        const cardElement = document.querySelector(`[data-id='${project.id}']`);
        if (cardElement) {
            const indicatorContainer = cardElement.querySelector('.status-indicator-container');
            if (indicatorContainer) {
                indicatorContainer.innerHTML = createStatusIndicatorHTML(overallStatus);
            }
        }
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const bgContainer = document.getElementById('background-layer');
    if (bgContainer) {
        bgContainer.innerHTML = renderBackground();
    }

    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        headerContainer.innerHTML = renderHeader();
    }

    const gridContainer = document.getElementById('projects-grid');
    if (gridContainer) {
        const cardsHTML = projects.map((project, index) => createCardHTML(project, index)).join('');
        gridContainer.innerHTML = cardsHTML;

        // После рендеринга карточек, запрашиваем и отображаем их статусы.
        updateProjectStatuses();
    }
});