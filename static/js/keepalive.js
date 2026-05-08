import { fetchConfig, fetchStats, saveConfig } from './keepalive/api.js';
import { renderStats, updateLastSync, setConnectionHint } from './keepalive/ui.js';
import { KeepAliveSettingsModal } from './keepalive/settings-modal.js';

let settingsModal = null;
let refreshTimer = null;
let loadingConfig = false;

async function refreshStats() {
    try {
        const stats = await fetchStats();
        renderStats(stats);
        updateLastSync(`Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`);
        setConnectionHint('Система активна');
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        updateLastSync('Ошибка соединения', true);
        setConnectionHint('Не удалось получить данные');
    }
}

async function loadAndOpenSettings() {
    if (loadingConfig) return;
    loadingConfig = true;
    try {
        updateLastSync('Загрузка настроек...');
        const config = await fetchConfig();
        settingsModal.open(config);
        setConnectionHint('Редактирование настроек');
    } catch (error) {
        settingsModal.open({ settings: {}, targets: [] });
        settingsModal.setMessage(error.message || 'Не удалось загрузить настройки.', 'error');
    } finally {
        loadingConfig = false;
    }
}

async function applyConfig(config) {
    const result = await saveConfig(config);
    await refreshStats();
    return {
        message: result?.ok ? 'Настройки сохранены и применены.' : 'Настройки обновлены.',
    };
}

function bindUi() {
    const openButton = document.getElementById('open-settings-btn');
    if (openButton) {
        openButton.addEventListener('click', () => {
            loadAndOpenSettings();
        });
    }
}

function initApp() {
    settingsModal = new KeepAliveSettingsModal({
        onApply: applyConfig,
    });

    bindUi();
    refreshStats();

    refreshTimer = window.setInterval(refreshStats, 60000);
}

window.addEventListener('DOMContentLoaded', initApp);

window.addEventListener('beforeunload', () => {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
});