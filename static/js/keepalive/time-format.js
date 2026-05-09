const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
});

function normalizeDateSource(value) {
    if (!value) {
        return null;
    }

    const source = String(value).trim();
    if (!source) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(source)) {
        return `${source.replace(' ', 'T')}Z`;
    }

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(source)) {
        return `${source}Z`;
    }

    return source;
}

export function formatLocalTime(value, fallback = 'Ожидание...') {
    const normalizedSource = normalizeDateSource(value);
    if (!normalizedSource) {
        return fallback;
    }

    const date = new Date(normalizedSource);
    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return DATE_TIME_FORMATTER.format(date);
}

export function formatCurrentLocalSyncTime() {
    return `Обновлено: ${DATE_TIME_FORMATTER.format(new Date())}`;
}
