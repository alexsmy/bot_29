/**
 * Модуль для управления микровзаимодействиями:
 * - Haptics (вибрация)
 * - Ripple (волны при клике)
 * - Button Press (анимация нажатия)
 */

// Проверка поддержки вибрации
const canVibrate = window.navigator && window.navigator.vibrate;

export const Haptics = {
    // Легкий клик (для обычных кнопок)
    light: () => {
        if (canVibrate) window.navigator.vibrate(10);
    },
    // Средний клик (для важных действий: Play, Pause)
    medium: () => {
        if (canVibrate) window.navigator.vibrate(40);
    },
    // Тяжелый/Двойной (для ошибок или удаления)
    heavy: () => {
        if (canVibrate) window.navigator.vibrate([50, 30, 50]);
    },
    // Успех (добавление в избранное)
    success: () => {
        if (canVibrate) window.navigator.vibrate([30, 50, 30]);
    }
};

// Функция создания эффекта волны (Ripple)
export function createRipple(event, element) {
    const circle = document.createElement("span");
    const diameter = Math.max(element.clientWidth, element.clientHeight);
    const radius = diameter / 2;

    // Получаем координаты клика относительно кнопки
    const rect = element.getBoundingClientRect();
    
    // Поддержка и мыши, и тача
    let clientX = event.clientX;
    let clientY = event.clientY;
    
    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    }

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${clientX - rect.left - radius}px`;
    circle.style.top = `${clientY - rect.top - radius}px`;
    circle.classList.add("ripple");

    // Удаляем существующий ripple, если он есть (для чистоты)
    const oldRipple = element.getElementsByClassName("ripple")[0];
    if (oldRipple) {
        oldRipple.remove();
    }

    element.appendChild(circle);
    
    // Автоматическое удаление элемента после завершения анимации (0.8s в CSS)
    setTimeout(() => {
        circle.remove();
    }, 800);
}

// Инициализация эффектов для всех интерактивных элементов
export function initInteractions() {
    // Делегирование событий для всего документа
    // Это позволяет обрабатывать клики даже на динамически созданных элементах (поиск, меню)
    document.addEventListener('click', (e) => {
        // Ищем ближайшую кнопку или интерактивный элемент
        const target = e.target.closest('button, .radio-menu-item, .control-btn, .glass-button');
        
        if (target) {
            // 1. Запускаем вибрацию (если не отключена атрибутом)
            if (!target.hasAttribute('data-no-haptic')) {
                // Разная вибрация для разных типов кнопок
                if (target.classList.contains('main-btn')) {
                    Haptics.medium();
                } else if (target.classList.contains('del-btn')) {
                    Haptics.heavy();
                } else {
                    Haptics.light();
                }
            }

            // 2. Запускаем Ripple эффект
            createRipple(e, target);
        }
    });

    // Добавляем CSS класс для анимации нажатия (scale)
    document.addEventListener('mousedown', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) target.classList.add('btn-pressed');
    });

    document.addEventListener('mouseup', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) setTimeout(() => target.classList.remove('btn-pressed'), 200); // Чуть дольше задержка для плавности
    });
    
    // Аналогично для Touch событий (мобильные)
    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) target.classList.add('btn-pressed');
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) setTimeout(() => target.classList.remove('btn-pressed'), 200);
    });
}