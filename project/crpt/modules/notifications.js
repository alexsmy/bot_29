/**
 * Модуль управления уведомлениями (Toasts)
 */

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Выбор иконки в зависимости от типа
    const iconMap = {
        'success': 'check-circle',
        'error': 'x-circle',
        'info': 'info',
        'warning': 'info'
    };
    const iconName = iconMap[type] || 'info';
    
    toast.innerHTML = `
        <svg class="icon"><use href="#icon-${iconName}"></use></svg>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Анимация появления
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}