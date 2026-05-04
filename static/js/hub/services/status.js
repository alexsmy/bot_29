/**
 * @module statusService
 * @description Модульный сервис для получения и кэширования статусов сервисов из API.
 * Обеспечивает единую точку доступа к данным о состоянии, избегая дублирования запросов.
 */

const statusService = (() => {
    let statusCache = null;
    let isFetching = false;
    let fetchPromise = null;

    /**
     * Асинхронно получает и кэширует данные о статусах с API.
     * @returns {Promise<Object|null>} Объект со статусами или null в случае ошибки.
     */
    const fetchAndCacheStatus = async () => {
        if (isFetching) {
            return fetchPromise;
        }

        isFetching = true;
        fetchPromise = (async () => {
            try {
                const response = await fetch('/api/stats');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                statusCache = data.stats.reduce((acc, stat) => {
                    acc[stat.name] = stat;
                    return acc;
                }, {});
                return statusCache;
            } catch (error) {
                console.error("Status Service Error: Не удалось получить данные о статусах.", error);
                return null;
            } finally {
                isFetching = false;
            }
        })();
        return fetchPromise;
    };

    /**
     * Возвращает общий статус всех отслеживаемых сервисов.
     * @returns {Promise<string>} Строка статуса ('operational', 'degraded', 'offline', 'unknown').
     */
    const getOverallStatus = async () => {
        const stats = await getStatus();
        if (!stats || Object.keys(stats).length === 0) {
            return 'unknown';
        }

        const statuses = Object.values(stats).map(stat => stat.status);

        if (statuses.every(s => s === 'Онлайн')) {
            return 'operational';
        }
        if (statuses.some(s => s === 'Оффлайн')) {
            return 'offline';
        }
        if (statuses.some(s => s === 'Онлайн')) {
            return 'degraded';
        }
        return 'unknown';
    };

    /**
     * Публичный метод для получения кэшированных статусов.
     * При необходимости инициирует загрузку данных.
     * @returns {Promise<Object|null>}
     */
    const getStatus = async () => {
        if (statusCache) {
            return statusCache;
        }
        return await fetchAndCacheStatus();
    };

    // Первоначальная загрузка данных при инициализации модуля
    fetchAndCacheStatus();

    return {
        getStatus,
        getOverallStatus
    };
})();

export { statusService };