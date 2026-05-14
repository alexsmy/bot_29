/**
 * FileVault UI Module
 * Handles toast notifications, clipboard operations, and UI helpers
 */

const Toast = {
    element: null,
    messageElement: null,
    timeoutId: null,

    init() {
        this.element = document.getElementById('toastNotification');
        this.messageElement = document.getElementById('toastMessage');
    },

    show(message, duration = 2500) {
        if (!this.element || !this.messageElement) {
            this.init();
        }

        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.messageElement.textContent = message;
        this.element.hidden = false;

        this.timeoutId = setTimeout(() => {
            this.hide();
        }, duration);
    },

    hide() {
        if (this.element) {
            this.element.hidden = true;
        }
    }
};

async function copyToClipboard(text, successMessage = 'Скопировано в буфер обмена') {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        Toast.show(successMessage);
        return true;
    } catch (error) {
        console.error('Failed to copy:', error);
        Toast.show('Не удалось скопировать', 2000);
        return false;
    }
}

function getFileIcon(file) {
    const original = file.original_name || '';
    const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';
    const contentType = file.content_type || '';

    const iconMap = {
        // Images
        png: 'fa-image', jpg: 'fa-image', jpeg: 'fa-image', gif: 'fa-image', webp: 'fa-image', svg: 'fa-image',
        // Documents
        pdf: 'fa-file-pdf', doc: 'fa-file-word', docx: 'fa-file-word', xls: 'fa-file-excel', xlsx: 'fa-file-excel',
        txt: 'fa-file-lines', md: 'fa-file-lines',
        // Code
        html: 'fa-html5', htm: 'fa-html5', css: 'fa-css3-alt', js: 'fa-js', json: 'fa-brackets-curly', py: 'fa-python',
        // Archives
        zip: 'fa-file-zipper', rar: 'fa-file-zipper', '7z': 'fa-file-zipper',
        // Media
        mp4: 'fa-file-video', mov: 'fa-file-video', avi: 'fa-file-video', mp3: 'fa-file-audio', wav: 'fa-file-audio'
    };

    if (ext && iconMap[ext]) {
        return `fa-solid ${iconMap[ext]}`;
    }

    if (contentType.startsWith('image/')) return 'fa-solid fa-image';
    if (contentType.startsWith('text/html')) return 'fa-solid fa-html5';
    if (contentType.startsWith('text/')) return 'fa-solid fa-file-lines';
    if (contentType.includes('pdf')) return 'fa-solid fa-file-pdf';
    if (contentType.startsWith('audio/')) return 'fa-solid fa-file-audio';
    if (contentType.startsWith('video/')) return 'fa-solid fa-file-video';

    return 'fa-solid fa-file';
}

function getFileColor(file) {
    const original = file.original_name || '';
    const ext = original.includes('.') ? original.split('.').pop().toLowerCase() : '';
    const contentType = file.content_type || '';

    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || contentType.startsWith('image/')) {
        return 'var(--success)';
    }
    if (['pdf'].includes(ext) || contentType.includes('pdf')) {
        return '#f87171';
    }
    if (['html', 'htm', 'css', 'js', 'json', 'py'].includes(ext)) {
        return '#fbbf24';
    }
    if (['zip', 'rar', '7z'].includes(ext)) {
        return '#a78bfa';
    }
    if (['mp4', 'mov', 'avi', 'mp3', 'wav'].includes(ext) || contentType.startsWith('audio/') || contentType.startsWith('video/')) {
        return '#38bdf8';
    }

    return 'var(--accent-2)';
}

export { Toast, copyToClipboard, getFileIcon, getFileColor };
