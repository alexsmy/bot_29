// static/js/welcome.js

document.addEventListener('DOMContentLoaded', () => {
    
    /**
     * Функция для загрузки и вставки SVG-иконок на страницу.
     */
    const loadIcons = () => {
        // Проверяем, существует ли объект WELCOME_ICONS (загружен ли welcome_icons.js)
        if (typeof WELCOME_ICONS === 'undefined') {
            console.error('Объект WELCOME_ICONS не найден. Убедитесь, что welcome_icons.js загружен перед этим скриптом.');
            return;
        }

        // Находим все элементы-плейсхолдеры для иконок
        const iconPlaceholders = document.querySelectorAll('[data-icon-name]');

        iconPlaceholders.forEach(placeholder => {
            const iconName = placeholder.dataset.iconName;
            if (WELCOME_ICONS[iconName]) {
                // Вставляем SVG-код иконки внутрь плейсхолдера
                placeholder.innerHTML = WELCOME_ICONS[iconName];
            } else {
                console.warn(`Иконка с именем "${iconName}" не найдена в WELCOME_ICONS.`);
            }
        });
    };

    // Вызываем функцию загрузки иконок
    loadIcons();
    
    // 1. Плавное появление элементов при прокрутке
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    const elementsToFadeIn = document.querySelectorAll('.fade-in');
    elementsToFadeIn.forEach(el => observer.observe(el));

    // 2. Параллакс-эффект для фоновых фигур (только на десктопах)
    const shapes = document.querySelectorAll('.shape');
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    if (isDesktop) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            shapes.forEach((shape, index) => {
                let speed = 0.1;
                if (index === 0) speed = 0.2;
                if (index === 1) speed = 0.15;
                
                const yPos = -scrollY * speed;
                shape.style.transform = `translateY(${yPos}px)`;
            });
        });
    }
});