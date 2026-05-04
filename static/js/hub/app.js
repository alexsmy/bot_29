

import { projects } from './data/projects.js';
import { createCardHTML } from './components/card.js';
import { renderBackground, renderHeader } from './components/layout.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Отрисовка фона
    const bgContainer = document.getElementById('background-layer');
    if (bgContainer) {
        bgContainer.innerHTML = renderBackground();
    }

    // 2. Отрисовка шапки
    const headerContainer = document.getElementById('header-container');
    if (headerContainer) {
        headerContainer.innerHTML = renderHeader();
    }

    // 3. Отрисовка сетки проектов
    const gridContainer = document.getElementById('projects-grid');
    if (gridContainer) {
        // Проходим по массиву проектов и генерируем HTML для каждой карточки
        const cardsHTML = projects.map((project, index) => createCardHTML(project, index)).join('');
        gridContainer.innerHTML = cardsHTML;
    }
});