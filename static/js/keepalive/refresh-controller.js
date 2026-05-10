const DEFAULT_REFRESH_SECONDS = 60;
const MIN_REFRESH_SECONDS = 5;
const MAX_REFRESH_SECONDS = 300;

function clampRefreshSeconds(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
        return DEFAULT_REFRESH_SECONDS;
    }
    return Math.min(MAX_REFRESH_SECONDS, Math.max(MIN_REFRESH_SECONDS, parsed));
}

export function getRefreshSecondsFromConfig(config) {
    return clampRefreshSeconds(config?.settings?.dashboard_refresh_seconds ?? DEFAULT_REFRESH_SECONDS);
}

export function formatRefreshLabel(seconds) {
    const normalizedSeconds = clampRefreshSeconds(seconds);
    return `${normalizedSeconds} сек`;
}

export class RefreshController {
    constructor(callback, options = {}) {
        this.callback = callback;
        this.intervalSeconds = clampRefreshSeconds(options.intervalSeconds ?? DEFAULT_REFRESH_SECONDS);
        this.timerId = null;
        this.isRunning = false;
    }

    getIntervalSeconds() {
        return this.intervalSeconds;
    }

    async runNow() {
        if (this.isRunning || typeof this.callback !== 'function') {
            return;
        }

        this.isRunning = true;
        try {
            await this.callback();
        } finally {
            this.isRunning = false;
        }
    }

    start() {
        this.stop();
        this.timerId = window.setInterval(() => {
            this.runNow();
        }, this.intervalSeconds * 1000);
    }

    updateInterval(seconds) {
        const nextInterval = clampRefreshSeconds(seconds);
        if (nextInterval === this.intervalSeconds && this.timerId) {
            return this.intervalSeconds;
        }

        const wasActive = Boolean(this.timerId);
        this.intervalSeconds = nextInterval;
        if (wasActive) {
            this.start();
        }
        return this.intervalSeconds;
    }

    stop() {
        if (this.timerId) {
            window.clearInterval(this.timerId);
            this.timerId = null;
        }
    }
}

export { DEFAULT_REFRESH_SECONDS, MIN_REFRESH_SECONDS, MAX_REFRESH_SECONDS, clampRefreshSeconds };
