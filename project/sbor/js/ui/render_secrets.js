import { els, state } from '../state.js';
import { maskSecretValue } from '../secret_detector.js';

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildMaskedPreview(finding) {
    const masked = maskSecretValue(finding.secretValue);
    const line = String(finding.lineText || '');
    if (!line) {
        return finding.snippet || `${finding.keyName || 'value'}: ${masked}`;
    }

    const raw = String(finding.secretValue || '');
    if (raw && line.includes(raw)) {
        return line.replace(new RegExp(escapeRegExp(raw), 'g'), masked);
    }

    return finding.snippet || line;
}

function buildSummaryHtml() {
    const summary = state.secretReview?.summary;
    if (!summary) return '';

    const excludedCount = state.secretReview?.excludedFiles?.size || 0;
    const safeSummary = {
        scannedFiles: summary.scannedFiles || 0,
        totalFindings: summary.totalFindings || 0,
        filesWithFindings: summary.filesWithFindings || 0,
        criticalFindings: summary.criticalFindings || 0,
        highFindings: summary.highFindings || 0,
        mediumFindings: summary.mediumFindings || 0
    };

    return `
        <div class="stats-grid" style="margin-bottom: 1rem;">
            <div class="stat-card">
                <div class="stat-label">Проверено файлов</div>
                <div class="stat-value highlight">${safeSummary.scannedFiles}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Найдено секретов</div>
                <div class="stat-value danger">${safeSummary.totalFindings}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Файлов с находками</div>
                <div class="stat-value">${safeSummary.filesWithFindings}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Исключено файлов</div>
                <div class="stat-value">${excludedCount}</div>
            </div>
        </div>
        <div class="info-box warning" style="margin-bottom: 1.25rem;">
            Обнаруживаются только высоковероятные секреты.
            Файлы можно оставить в сборке с маскированием или исключить целиком вручную.
        </div>
    `;
}

function renderFindingRow(finding) {
    const row = document.createElement('div');
    row.className = 'secret-finding';

    const meta = document.createElement('div');
    meta.className = 'secret-finding-meta';
    meta.innerHTML = `
        <span class="secret-badge secret-badge-${finding.severity}">${escapeHtml(finding.severity)}</span>
        <span class="secret-badge">${escapeHtml(finding.category)}</span>
        <span class="secret-badge">line ${finding.lineNumber}</span>
        <span class="secret-badge">${finding.confidence}%</span>
    `;

    const title = document.createElement('div');
    title.className = 'secret-finding-title';
    title.textContent = finding.providerLabel || finding.reason || 'Подозрительное значение';

    const code = document.createElement('div');
    code.className = 'secret-preview';
    code.textContent = buildMaskedPreview(finding);

    row.appendChild(meta);
    row.appendChild(title);
    row.appendChild(code);
    return row;
}

function syncFileExclusion(path, shouldExclude) {
    if (!state.secretReview) return;

    if (shouldExclude) {
        state.secretReview.excludedFiles.add(path);
        state.finalSelectedPaths.delete(path);
    } else {
        state.secretReview.excludedFiles.delete(path);
        if (state.acceptedFiles.some(item => item.path === path)) {
            state.finalSelectedPaths.add(path);
        }
    }

    state.detectedSecrets.forEach(finding => {
        if (finding.filePath === path) {
            finding.selected = !shouldExclude;
            finding.shouldExcludeFile = shouldExclude;
        }
    });

    if (els.secretScanSummary) {
        els.secretScanSummary.innerHTML = buildSummaryHtml();
    }
}

function groupFindingsByFile(findings) {
    const groups = new Map();
    findings.forEach(finding => {
        const group = groups.get(finding.filePath) || {
            filePath: finding.filePath,
            findings: [],
            maxConfidence: 0,
            highestSeverity: 'low'
        };
        group.findings.push(finding);
        group.maxConfidence = Math.max(group.maxConfidence, finding.confidence);
        if (finding.severity === 'critical') group.highestSeverity = 'critical';
        else if (finding.severity === 'high' && group.highestSeverity !== 'critical') group.highestSeverity = 'high';
        else if (finding.severity === 'medium' && !['critical', 'high'].includes(group.highestSeverity)) group.highestSeverity = 'medium';
        groups.set(finding.filePath, group);
    });

    return Array.from(groups.values()).sort((a, b) => a.filePath.localeCompare(b.filePath));
}

export function renderSecretsList() {
    els.listSecrets.innerHTML = '';

    if (els.secretScanSummary) {
        els.secretScanSummary.innerHTML = buildSummaryHtml();
    }

    if (state.detectedSecrets.length === 0) {
        const noSecDiv = document.createElement('div');
        noSecDiv.className = 'info-box success-box';
        noSecDiv.innerHTML = '✅ Высоковероятные секреты не обнаружены. Можно переходить к генерации.';
        els.listSecrets.appendChild(noSecDiv);
        return;
    }

    const grouped = groupFindingsByFile(state.detectedSecrets);

    grouped.forEach(group => {
        const card = document.createElement('div');
        card.className = 'secret-file-card';

        const header = document.createElement('div');
        header.className = 'secret-file-header';

        const left = document.createElement('div');
        left.className = 'secret-file-title';

        const title = document.createElement('div');
        title.innerHTML = `<strong>${escapeHtml(group.filePath)}</strong>`;

        const badgeRow = document.createElement('div');
        badgeRow.className = 'secret-finding-meta';
        badgeRow.innerHTML = `
            <span class="secret-badge secret-badge-${group.highestSeverity}">${escapeHtml(group.highestSeverity)}</span>
            <span class="secret-badge">${group.findings.length} находок</span>
            <span class="secret-badge">до ${group.maxConfidence}%</span>
        `;

        left.appendChild(title);
        left.appendChild(badgeRow);

        const right = document.createElement('label');
        right.className = 'secret-file-toggle';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = state.secretReview.excludedFiles.has(group.filePath);
        cb.dataset.path = group.filePath;

        const cbText = document.createElement('span');
        cbText.textContent = 'Исключить файл из сборки';

        right.appendChild(cb);
        right.appendChild(cbText);

        header.appendChild(left);
        header.appendChild(right);
        card.appendChild(header);

        const body = document.createElement('div');
        body.className = 'secret-file-body';
        group.findings.forEach(finding => {
            body.appendChild(renderFindingRow(finding));
        });
        card.appendChild(body);

        cb.addEventListener('change', () => {
            syncFileExclusion(group.filePath, cb.checked);
        });

        els.listSecrets.appendChild(card);
    });
}
