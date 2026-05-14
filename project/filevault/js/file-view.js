export class FileView {
  constructor(onChange) {
    this.onChange = onChange;
    this.storageKey = 'filevault.view-mode';
    this.container = document.getElementById('view-switch');

    if (!this.container) this.createSwitch();
    this.bindEvents();

    const saved = this.readSavedMode();
    this.setActive(saved, false);
  }

  readSavedMode() {
    try {
      const mode = localStorage.getItem(this.storageKey);
      return ['grid', 'list', 'table'].includes(mode) ? mode : 'grid';
    } catch {
      return 'grid';
    }
  }

  saveMode(mode) {
    try {
      localStorage.setItem(this.storageKey, mode);
    } catch {
      // Ignore storage failures in private or restricted contexts.
    }
  }

  createSwitch() {
    const toolbar = document.querySelector('.toolbar-actions');
    if (!toolbar) return;

    const div = document.createElement('div');
    div.id = 'view-switch';
    div.className = 'view-switch';
    div.innerHTML = `
      <button type="button" data-view="grid" title="Плитка" aria-label="Плитка">⊞</button>
      <button type="button" data-view="list" title="Список" aria-label="Список">☰</button>
      <button type="button" data-view="table" title="Таблица" aria-label="Таблица">⎔</button>
    `;

    toolbar.prepend(div);
    this.container = div;
  }

  bindEvents() {
    if (!this.container) return;

    this.container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-view]');
      if (!btn) return;

      const mode = btn.dataset.view;
      this.setActive(mode);
      this.saveMode(mode);

      if (this.onChange) this.onChange(mode);
    });
  }

  setActive(mode, persist = true) {
    if (!this.container) return;

    const normalized = ['grid', 'list', 'table'].includes(mode) ? mode : 'grid';
    Array.from(this.container.children).forEach((btn) => btn.classList.remove('active'));

    const activeBtn = this.container.querySelector(`[data-view="${normalized}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    document.body.dataset.vaultView = normalized;

    if (persist) this.saveMode(normalized);
  }
}
