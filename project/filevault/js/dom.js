// project/filevault/js/dom.js
export function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatBytes(bytes) {
  if (!+bytes) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d) ? '—' : d.toLocaleString();
}

export function detectFileType(file) {
  const ext = (file.original_name || '').split('.').pop().toLowerCase();
  const map = {
    html: '🌐', htm: '🌐', css: '🎨', js: '⚙️', py: '🐍', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', pdf: '📕', txt: '📝', md: '📝', zip: '🗜️', mp3: '🎧', mp4: '🎬', crpt: '🔒'
  };
  return { icon: map[ext] || '📄', label: ext.toUpperCase() || 'Файл' };
}

function renderFolderBranch(node, activeFolderId) {
  const children = node.children || [];
  const isActive = (node.folder_id ?? null) === (activeFolderId ?? null);
  return `
    <div class="folder-branch level-${node.level||0}">
      <button class="folder-node${isActive ? ' active' : ''}" data-action="select-folder" data-folder-id="${escapeHTML(node.folder_id??'')}">
        <span class="folder-dot"></span>
        <span class="folder-name">${escapeHTML(node.name)}</span>
        <span class="folder-badge">${node.file_count||0}</span>
        <span class="folder-size">${formatBytes(node.size_bytes)}</span>
      </button>
      ${children.map(c => renderFolderBranch(c, activeFolderId)).join('')}
    </div>
  `;
}

export function renderFolderTree(tree, activeFolderId, rootCount) {
  return `
    <div class="folder-branch root">
      <button class="folder-node${activeFolderId === null ? ' active' : ''}" data-action="select-folder" data-folder-id="">
        <span class="folder-dot"></span><span>Корень</span><span class="folder-badge">${rootCount||0}</span>
      </button>
      ${tree.filter(n => n.parent_id === null).map(n => renderFolderBranch(n, activeFolderId)).join('')}
    </div>
  `;
}

export function renderFolderOptions(tree, selectedId) {
  const opts = ['<option value="">Корень</option>'];
  const walk = (nodes, depth=0) => {
    nodes.forEach(n => {
      opts.push(`<option value="${escapeHTML(n.folder_id)}" ${selectedId===n.folder_id?'selected':''}>${'—'.repeat(depth)} ${escapeHTML(n.name)}</option>`);
      if (n.children) walk(n.children, depth+1);
    });
  };
  walk(tree.filter(n => n.parent_id === null));
  return opts.join('');
}

export function renderFileCard(file, selected) {
  const type = detectFileType(file);
  const isCrpt = file.isCrpt;
  return `
    <div class="file-card ${selected ? 'selected' : ''}" data-file-id="${escapeHTML(file.file_id)}">
      <label class="file-check"><input type="checkbox" ${selected ? 'checked' : ''}></label>
      <div class="file-icon">${type.icon}</div>
      <div class="file-title" title="${escapeHTML(file.original_name)}">${escapeHTML(file.original_name)}</div>
      <div class="file-size">${formatBytes(file.size_bytes)}</div>
      <div class="file-date">${formatDateTime(file.uploaded_at)}</div>
      ${isCrpt ? `<button type="button" class="action-button delete-crpt-btn" data-crpt-id="${escapeHTML(file.id)}">Удалить</button>` : ''}
    </div>
  `;
}

export function renderFileTableRow(file, selected) {
  const type = detectFileType(file);
  const isCrpt = file.isCrpt;
  return `
    <div class="file-card ${selected ? 'selected' : ''}" data-file-id="${escapeHTML(file.file_id)}">
      <label class="file-check"><input type="checkbox" ${selected ? 'checked' : ''}></label>
      <div class="file-title">${type.icon} ${escapeHTML(file.original_name)}</div>
      <div class="file-size">${formatBytes(file.size_bytes)}</div>
      <div class="file-date">${formatDateTime(file.uploaded_at)}</div>
      <div class="file-actions">${isCrpt ? `<button type="button" class="action-button delete-crpt-btn" data-crpt-id="${escapeHTML(file.id)}">Удалить</button>` : ''}</div>
    </div>
  `;
}

export function renderFileListItem(file, selected) {
  const type = detectFileType(file);
  const isCrpt = file.isCrpt;
  return `
    <div class="file-card ${selected ? 'selected' : ''}" data-file-id="${escapeHTML(file.file_id)}">
      <label class="file-check"><input type="checkbox" ${selected ? 'checked' : ''}></label>
      <span class="file-icon">${type.icon}</span>
      <span class="file-title">${escapeHTML(file.original_name)}</span>
      ${isCrpt ? `<button type="button" class="action-button delete-crpt-btn" data-crpt-id="${escapeHTML(file.id)}">Удалить</button>` : ''}
    </div>
  `;
}

export function renderSelectedDetails(file) {
  const type = detectFileType(file);
  return `
    <div class="selected-file-card">
      <div class="selected-file-head">
        <div class="details-icon">${type.icon}</div>
        <div><h3>${escapeHTML(file.original_name)}</h3></div>
      </div>
      <dl class="details-list">
        <div><dt>Размер</dt><dd>${formatBytes(file.size_bytes)}</dd></div>
        <div><dt>Загружен</dt><dd>${formatDateTime(file.uploaded_at)}</dd></div>
        <div><dt>Тип</dt><dd>${type.label}</dd></div>
      </dl>
      <div class="details-actions">
        <button class="action-button" data-action="open-file">Открыть</button>
        <button class="action-button" data-action="copy-link">Копировать ссылку</button>
        ${!file.isCrpt ? `<button class="action-button" data-action="rename-file">Переименовать</button>
        <button class="action-button" data-action="move-file">Переместить</button>` : ''}
        <button class="action-button danger" data-action="delete-file">Удалить</button>
      </div>
    </div>
  `;
}

export function renderEmptyFilesState(message) {
  return `<div class="file-empty">${escapeHTML(message)}</div>`;
}

export function renderBulkSummary(selectedCount, folderLabel) {
  return `<strong>${selectedCount} файлов выбрано</strong><span>Папка: ${escapeHTML(folderLabel)}</span>`;
}