export class FileView {
  constructor(onChange) {
    this.onChange = onChange;
    this.container = document.getElementById('view-switch');
    if (!this.container) this.createSwitch();
    this.bindEvents();
  }
  createSwitch() {
    const toolbar = document.querySelector('.toolbar-actions');
    if (!toolbar) return;
    const div = document.createElement('div');
    div.id = 'view-switch';
    div.className = 'view-switch';
    div.innerHTML = `
      <button data-view="grid" title="Плитка">⊞</button>
      <button data-view="list" title="Список">☰</button>
      <button data-view="table" title="Таблица">⎔</button>
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
      if (this.onChange) this.onChange(mode);
    });
  }
  setActive(mode) {
    if (!this.container) return;
    Array.from(this.container.children).forEach(btn => btn.classList.remove('active'));
    const activeBtn = this.container.querySelector(`[data-view="${mode}"]`);
    if (activeBtn) activeBtn.classList.add('active');
  }
}