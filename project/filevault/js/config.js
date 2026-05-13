export const API_BASE = '/api/filevault';
export const OPEN_BASE = '/files/open';

export function buildPublicUrl(fileId) {
    return `${window.location.origin}${OPEN_BASE}/${encodeURIComponent(fileId)}`;
}
