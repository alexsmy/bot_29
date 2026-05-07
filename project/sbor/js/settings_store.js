export const STORAGE_KEYS = {
    appSettings: 'sbor_app_settings',
    theme: 'sbor_theme',
    aiModel: 'sbor_ai_model',
    exportFormat: 'sbor_export_format',
    optimizeCode: 'sbor_cb_optimize',
    repoMap: 'sbor_cb_repo_map'
};

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // LocalStorage may be unavailable in some contexts; fail silently.
    }
}

export function loadAppSettings(defaults) {
    const stored = readJson(STORAGE_KEYS.appSettings, null);
    if (!stored || typeof stored !== 'object') {
        return typeof structuredClone === 'function' ? structuredClone(defaults) : JSON.parse(JSON.stringify(defaults));
    }

    const next = typeof structuredClone === 'function' ? structuredClone(defaults) : JSON.parse(JSON.stringify(defaults));
    if (typeof stored.useGitignore === 'boolean') next.useGitignore = stored.useGitignore;
    if (typeof stored.excludeLargeFiles === 'boolean') next.excludeLargeFiles = stored.excludeLargeFiles;
    if (typeof stored.maxFileSizeMb === 'number' && Number.isFinite(stored.maxFileSizeMb)) {
        next.maxFileSizeMb = stored.maxFileSizeMb;
    }

    if (stored.theme === 'dark' || stored.theme === 'light') {
        next.theme = stored.theme;
    }

    if (stored.secretDetection && typeof stored.secretDetection === 'object') {
        next.secretDetection = {
            ...next.secretDetection,
            ...stored.secretDetection
        };
    }

    return next;
}

export function saveAppSettings(settings) {
    writeJson(STORAGE_KEYS.appSettings, settings);
    if (settings?.theme) {
        writeJson(STORAGE_KEYS.theme, settings.theme);
    }
}

export function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    writeJson(STORAGE_KEYS.theme, nextTheme);
    return nextTheme;
}

export function readStoredTheme() {
    const stored = localStorage.getItem(STORAGE_KEYS.theme);
    return stored === 'dark' ? 'dark' : 'light';
}

export function readStoredFlag(key, fallback = false) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === 'true';
}

export function saveStoredFlag(key, value) {
    writeJson(key, Boolean(value));
}
