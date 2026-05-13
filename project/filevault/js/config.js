export const API_BASE = '/api/filevault';
export const OPEN_BASE = '/files/open';

export function buildPublicUrl(value) {
    if (!value) return window.location.origin;

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${window.location.origin}${value}`;
    }

    return `${window.location.origin}${OPEN_BASE}/${encodeURIComponent(value)}`;
}
