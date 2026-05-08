
const modal = document.getElementById('settings-modal');

export async function loadSettings() {
    const response = await fetch('/api/keepalive/config');
    return response.json();
}

export function openSettingsModal() {
    modal.classList.remove('hidden');
}

export function closeSettingsModal() {
    modal.classList.add('hidden');
}

export function renderSettings(config) {
    document.getElementById('min-wait').value = config.settings.min_wait_minutes;
    document.getElementById('max-wait').value = config.settings.max_wait_minutes;
    document.getElementById('error-wait').value = config.settings.error_wait_seconds;
    document.getElementById('initial-delay').value = config.settings.initial_delay_seconds;

    const list = document.getElementById('targets-list');
    list.innerHTML = '';

    config.targets.forEach((target, index) => {
        const row = document.createElement('div');
        row.className = 'target-item';
        row.innerHTML = `
            <input type="text" data-field="name" placeholder="Название" value="${target.name || ''}">
            <input type="url" data-field="url" placeholder="https://example.com" value="${target.url || ''}">
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" data-field="enabled" ${target.enabled !== false ? 'checked' : ''}>
                Активен
            </label>
            <button class="icon-button delete-target-btn" type="button">
                <i class="fa-solid fa-trash"></i>
            </button>
        `;

        row.querySelector('.delete-target-btn').addEventListener('click', () => {
            row.remove();
        });

        list.appendChild(row);
    });
}

export function collectSettingsPayload() {
    const targets = [...document.querySelectorAll('.target-item')].map((row) => ({
        name: row.querySelector('[data-field="name"]').value.trim(),
        url: row.querySelector('[data-field="url"]').value.trim(),
        enabled: row.querySelector('[data-field="enabled"]').checked
    })).filter((item) => item.name && item.url);

    return {
        settings: {
            min_wait_minutes: Number(document.getElementById('min-wait').value),
            max_wait_minutes: Number(document.getElementById('max-wait').value),
            error_wait_seconds: Number(document.getElementById('error-wait').value),
            initial_delay_seconds: Number(document.getElementById('initial-delay').value)
        },
        targets
    };
}

export async function saveSettings(payload) {
    const response = await fetch('/api/keepalive/config', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return response.json();
}

export function addTargetRow() {
    const list = document.getElementById('targets-list');

    const row = document.createElement('div');
    row.className = 'target-item';
    row.innerHTML = `
        <input type="text" data-field="name" placeholder="Название сервиса">
        <input type="url" data-field="url" placeholder="https://example.com">
        <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" data-field="enabled" checked>
            Активен
        </label>
        <button class="icon-button delete-target-btn" type="button">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;

    row.querySelector('.delete-target-btn').addEventListener('click', () => row.remove());

    list.appendChild(row);
}
