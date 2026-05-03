export function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ path: file.webkitRelativePath, content: reader.result });
        reader.onerror = reject;
        reader.readAsText(file);
    });
}

export function downloadFile(content, extension = 'txt') {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');

    const safeExt = String(extension || 'txt').replace(/^\.+/, '').toLowerCase() || 'txt';
    const filename = `project_${day}${month}${year}_${hour}${minute}.${safeExt}`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(url), 0);
}