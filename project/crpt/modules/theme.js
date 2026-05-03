/**
 * Модуль управления темой оформления
 */

export function initTheme() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Загрузка сохраненной темы
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(themeToggleBtn, savedTheme);

    // Обработчик переключения
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('app-theme', newTheme);
            updateThemeIcon(themeToggleBtn, newTheme);
        });
    }
}

function updateThemeIcon(btn, theme) {
    if (btn) {
        const iconName = theme === 'dark' ? 'sun' : 'moon';
        btn.innerHTML = `<svg class="icon"><use href="#icon-${iconName}"></use></svg>`;
    }
}