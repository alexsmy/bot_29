export function createCheckboxRow(value, id, checked, tagText, tagClass = '') {
    const div = document.createElement('div');
    div.className = 'file-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.value = value;
    cb.checked = checked;

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = value;

    if (tagText) {
        const span = document.createElement('span');
        span.className = `file-tag ${tagClass}`;
        span.textContent = tagText;
        label.appendChild(span);
    }

    div.appendChild(cb);
    div.appendChild(label);
    return div;
}