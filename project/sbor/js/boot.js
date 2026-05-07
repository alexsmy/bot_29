import { appTemplate } from './template.js';

function bootstrapApplication() {

    const root = document.getElementById('app-root');

    if (root) {
        root.innerHTML = appTemplate;
    } else {

        document.body.insertAdjacentHTML('afterbegin', appTemplate);
    }

    import('./app.js').then(() => {
        console.log('[Bootstrapper] Интерфейс загружен, приложение успешно инициализировано.');
    }).catch(error => {
        console.error('[Bootstrapper] Ошибка при загрузке app.js:', error);

        const statusArea = document.getElementById('status-area');
        if (statusArea) {
            statusArea.style.display = 'block';
            statusArea.style.color = '#dc2626';
            statusArea.style.backgroundColor = '#fee2e2';
            statusArea.style.borderColor = '#f87171';
            statusArea.innerHTML = `<strong>Ошибка инициализации:</strong> Не удалось запустить основную логику приложения. Подробности в консоли.`;
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApplication);
} else {
    bootstrapApplication();
}