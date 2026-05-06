// Конфигурация для генерации цветов
const COLOR_CONFIG = {
    minLightness: 30, // Достаточно темно, но с цветом
    maxLightness: 65, // Не слишком ярко, чтобы текст читался
    minSaturation: 60, // Сочные цвета
    maxSaturation: 100,
    // Параметры времени (в секундах)
    minDuration: 8,
    maxDuration: 22
};

let blobs = [];
let baseBackgroundInterval = null;

// Генерация случайного числа в диапазоне
const random = (min, max) => Math.random() * (max - min) + min;

// Генерация полностью случайного цвета (без привязки к базе)
function getRandomColor() {
    const hue = Math.floor(random(0, 360)); // Полный спектр
    const saturation = Math.floor(random(COLOR_CONFIG.minSaturation, COLOR_CONFIG.maxSaturation));
    const lightness = Math.floor(random(COLOR_CONFIG.minLightness, COLOR_CONFIG.maxLightness));
    
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Инициализация фоновых пятен
export function initDynamicBackground() {
    const container = document.getElementById('dynamic-background');
    if (!container) return;

    container.innerHTML = ''; // Очистка
    blobs = [];

    // Создаем 4 пятна (Task 1)
    for (let i = 0; i < 4; i++) {
        const blob = document.createElement('div');
        blob.classList.add('bg-blob');
        container.appendChild(blob);
        
        // Создаем объект управления пятном
        const blobObj = {
            element: blob,
            timeoutId: null
        };
        
        blobs.push(blobObj);
        
        // Запускаем независимый цикл анимации для каждого пятна
        animateBlob(blobObj, true); // true = мгновенный старт без задержки
    }

    // Запускаем анимацию базового фона (подложки)
    startBaseBackgroundAnimation(container);
}

// Функция независимой анимации одного пятна
function animateBlob(blobObj, immediate = false) {
    const el = blobObj.element;
    
    // 1. Вычисляем случайную длительность перехода (скорость)
    // Это обеспечивает независимость движения (Task 2)
    const duration = random(COLOR_CONFIG.minDuration, COLOR_CONFIG.maxDuration);
    
    // 2. Генерируем новые параметры
    const color = getRandomColor();
    
    // Позиция: от -20% до 80% экрана (чтобы пятна уходили за край и возвращались)
    const x = random(-20, 80); 
    const y = random(-20, 80);
    
    // Размер: от 40% до 90% ширины вьюпорта (крупные пятна)
    const size = random(40, 90); 
    const sizeUnit = 'vmin'; // Используем vmin для адаптивности
    
    // 3. Применяем стили
    // Важно: задаем transition динамически, чтобы он совпадал с длительностью цикла
    el.style.transition = `all ${duration}s ease-in-out`;
    
    // Если это первый запуск, применяем стили сразу, иначе браузер будет анимировать от дефолта
    if (immediate) {
        el.style.transition = 'none';
        requestAnimationFrame(() => {
             el.style.transition = `all ${duration}s ease-in-out`;
        });
    }

    el.style.backgroundColor = color;
    el.style.width = `${size}${sizeUnit}`;
    el.style.height = `${size}${sizeUnit}`;
    el.style.transform = `translate(${x}vw, ${y}vh)`;

    // 4. Планируем следующий кадр анимации
    // Рекурсивный вызов через setTimeout создает бесконечный независимый цикл
    if (blobObj.timeoutId) clearTimeout(blobObj.timeoutId);
    
    blobObj.timeoutId = setTimeout(() => {
        animateBlob(blobObj);
    }, duration * 1000); // Переводим секунды в мс
}

// Анимация самой темной подложки (основы)
function startBaseBackgroundAnimation(container) {
    const updateBase = () => {
        // Генерируем очень темный, насыщенный цвет для глубины
        const hue = Math.floor(random(0, 360));
        const sat = random(40, 60);
        const light = random(5, 12); // Очень темно (5-12%)
        
        container.style.backgroundColor = `hsl(${hue}, ${sat}%, ${light}%)`;
    };

    updateBase(); // Сразу
    
    if (baseBackgroundInterval) clearInterval(baseBackgroundInterval);
    
    // Меняем базу каждые 15 секунд (очень плавно, transition задан в CSS)
    baseBackgroundInterval = setInterval(updateBase, 15000);
}

// Функция принудительной смены темы (например, при клике на станцию)
// Она "встряхивает" все пятна, заставляя их сменить направление и цвет
export function setRandomTheme() {
    blobs.forEach(blobObj => {
        // Сбрасываем текущий таймер
        if (blobObj.timeoutId) clearTimeout(blobObj.timeoutId);
        // Запускаем новую анимацию немедленно
        animateBlob(blobObj);
    });
    
    // Также обновляем подложку
    const container = document.getElementById('dynamic-background');
    if (container) {
        // Генерируем новый темный цвет
        const hue = Math.floor(random(0, 360));
        container.style.backgroundColor = `hsl(${hue}, 50%, 8%)`;
    }
}