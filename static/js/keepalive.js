import { fetchConfig, fetchPinStatus, fetchStats, saveConfig, unlockSettings } from './keepalive/api.js';
import { renderStats, updateLastSync, setConnectionHint, updateRefreshIntervalLabel } from './keepalive/ui.js';
import { KeepAliveSettingsModal } from './keepalive/settings-modal.js';
import { KeepAlivePinModal } from './keepalive/pin-modal.js';
import { formatCurrentLocalSyncTime } from './keepalive/time-format.js';
import { RefreshController, getRefreshSecondsFromConfig } from './keepalive/refresh-controller.js';

let settingsModal = null;
let pinModal = null;
let refreshController = null;
let loadingConfig = false;
let cachedConfig = null;

async function refreshStats() {
    try {
        const stats = await fetchStats();
        renderStats(stats);
        updateLastSync(formatCurrentLocalSyncTime());
        setConnectionHint('Система активна');
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        updateLastSync('Ошибка соединения', true);
        setConnectionHint('Не удалось получить данные');
    }
}

function applyDashboardRefreshInterval(config) {
    const refreshSeconds = getRefreshSecondsFromConfig(config);
    if (refreshController) {
        refreshController.updateInterval(refreshSeconds);
    }
    updateRefreshIntervalLabel(refreshSeconds);
}

async function loadAndOpenSettings() {
    // FIX 1: Prevent queue buildup with early return and warning
    if (loadingConfig) {
        console.warn('Загрузка настроек уже в процессе. Повтор через 500мс...');
        return;
    }

    loadingConfig = true;
    try {
        updateLastSync('Загрузка настроек...');
        const config = await fetchConfig();
        cachedConfig = config;
        applyDashboardRefreshInterval(config);
        settingsModal.open(config);
        setConnectionHint('Редактирование настроек');
    } catch (error) {
        console.error('Ошибка при загрузке настроек:', error);
        
        if (error.status === 401) {
            try {
                const pinStatus = await fetchPinStatus();
                pinModal.open(pinStatus);
                setConnectionHint('Требуется PIN');
            } catch (pinError) {
                console.error('Ошибка получения статуса PIN:', pinError);
                pinModal.open({});
                setConnectionHint('Требуется PIN (статус недоступен)');
            }
            return;
        }

        settingsModal.open(cachedConfig || { settings: {}, targets: [] });
        settingsModal.setMessage(error.message || 'Не удалось загрузить настройки.', 'error');
    } finally {
        // FIX 2: Guaranteed reset of loading flag in finally block
        loadingConfig = false;
    }
}

async function handlePinSubmit(pin) {
    await unlockSettings(pin);
    await loadAndOpenSettings();
}

async function applyConfig(config) {
    const result = await saveConfig(config);
    if (result?.config) {
        cachedConfig = result.config;
        applyDashboardRefreshInterval(result.config);
    }
    await refreshController?.runNow();
    return {
        message: result?.ok ? 'Настройки сохранены и применены.' : 'Настройки обновлены.',
        config: result?.config,
    };
}

function bindUi() {
    const openButton = document.getElementById('open-settings-btn');
    if (openButton) {
        openButton.addEventListener('click', () => {
            loadAndOpenSettings();
        });
    }

    // FIX 3: Handle back navigation with proper cleanup
    const backLink = document.querySelector('.back-link');
    if (backLink) {
        backLink.addEventListener('click', (e) => {
            // Ensure cleanup before navigation
            if (refreshController) {
                refreshController.stop();
            }
            loadingConfig = false; // Reset any pending state
        });
    }
}

function initApp() {
    settingsModal = new KeepAliveSettingsModal({
        onApply: applyConfig,
    });
    pinModal = new KeepAlivePinModal({
        onSubmit: handlePinSubmit,
    });
    refreshController = new RefreshController(refreshStats);

    bindUi();
    applyDashboardRefreshInterval(cachedConfig);
    refreshController.runNow();
    refreshController.start();
}

window.addEventListener('DOMContentLoaded', initApp);

// FIX 4: Clean unload handler
window.addEventListener('beforeunload', () => {
    if (refreshController) {
        refreshController.stop();
    }
    loadingConfig = false;
});

// FIX 5: Pause updates when tab is hidden to save bandwidth and reduce load
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        if (refreshController) {
            refreshController.stop();
            console.info('Обновления паузированы (вкладка в фоне)');
        }
    } else {
        if (refreshController) {
            refreshController.start();
            console.info('Обновления возобновлены (вкладка активна)');
        }
    }
});
