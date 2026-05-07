import { normalizePath } from '../smart_filter/path_utils.js';
import { SUPPORT_FILE_NAMES } from './constants.js';

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeXmlAttr(value) {
    return escapeHtml(value).replace(/\r?\n/g, ' ');
}

export function escapeCdata(value) {
    return String(value ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>');
}

export function basename(path) {
    const parts = String(path || '').split('/');
    return parts[parts.length - 1] || '';
}

export function isSupportFile(path) {
    const normalized = normalizePath(path).toLowerCase();
    const name = basename(normalized);
    if (SUPPORT_FILE_NAMES.has(name)) return true;
    return normalized.includes('/formatters/md_formatter.js')
        || normalized.includes('/formatters/xml_formatter.js')
        || normalized.includes('/ui/render_analysis_package.js');
}

export function getLanguageLabel(ext, path = '') {
    const lowerPath = String(path || '').toLowerCase();
    if (ext === '.tsx' || ext === '.jsx' || lowerPath.endsWith('.tsx') || lowerPath.endsWith('.jsx')) return 'React/JSX';
    if (ext === '.ts') return 'TypeScript';
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'JavaScript';
    if (ext === '.html' || ext === '.htm') return 'HTML';
    if (ext === '.vue') return 'Vue';
    if (ext === '.svelte') return 'Svelte';
    if (ext === '.css') return 'CSS';
    if (ext === '.scss') return 'SCSS';
    if (ext === '.less') return 'Less';
    if (ext === '.py') return 'Python';
    if (ext === '.php') return 'PHP';
    if (ext === '.xml') return 'XML';
    if (ext === '.json') return 'JSON';
    if (ext === '.yml' || ext === '.yaml') return 'YAML';
    if (ext === '.md') return 'Markdown';
    if (ext === '.sql') return 'SQL';
    if (ext === '.java') return 'Java';
    if (ext === '.cs') return 'C#';
    if (ext === '.go') return 'Go';
    if (ext === '.rs') return 'Rust';
    if (ext === '.swift') return 'Swift';
    if (ext === '.kt') return 'Kotlin';
    return ext ? ext.slice(1).toUpperCase() : 'TEXT';
}

export function parseJsonSafely(text) {
    try {
        return JSON.parse(String(text || ''));
    } catch {
        return null;
    }
}