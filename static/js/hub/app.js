import { projects } from './data/projects.js';
import { createCardHTML } from './components/card.js';
import { createProjectVariantCardHTML, renderProjectSelectorModal } from './components/projectSelector.js';
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

function initProjectSelector() {
    const modal = document.getElementById('project-selector-modal');
    const closeButton = document.getElementById('project-selector-close');
    const backButton = document.getElementById('project-selector-back');
    const titleEl = document.getElementById('project-selector-title');
    const descriptionEl = document.getElementById('project-selector-description');
    const listEl = document.getElementById('project-selector-list');
    const gridContainer = document.getElementById('projects-grid');

    if (!modal || !closeButton || !backButton || !titleEl || !descriptionEl || !listEl || !gridContainer) {
        return;
    }

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('overflow-hidden');
        listEl.innerHTML = '';
    };

    const openModalForProject = (projectId) => {
        const project = projects.find(item => item.id === projectId);
        if (!project || !project.variants || project.variants.length === 0) {
            return;
        }

        titleEl.textContent = project.selectorTitle || `Выберите версию ${project.title}`;
        descriptionEl.textContent = project.selectorDescription || project.description || '';
        listEl.innerHTML = project.variants.map((variant, index) => createProjectVariantCardHTML(variant, index)).join('');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('overflow-hidden');
    };

    gridContainer.addEventListener('click', (event) => {
        const selectorCard = event.target.closest('[data-selector-id]');
        if (!selectorCard) {
            return;
        }

        event.preventDefault();
        openModalForProject(selectorCard.dataset.selectorId);
    });

    closeButton.addEventListener('click', closeModal);
    backButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
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

    const modalHTML = renderProjectSelectorModal();
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    initProjectSelector();
});
