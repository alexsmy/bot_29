class UploadProgress {
  constructor() {
    this.container = null;
    this.items = new Map();
  }
  show(container) {
    this.container = container;
    if (!this.container) return;
    this.container.innerHTML = '<div class="upload-progress"></div>';
    this.container.hidden = false;
  }
  addFile(filename) {
    if (!this.container) return;
    const div = document.createElement('div');
    div.className = 'progress-item';
    div.dataset.name = filename;
    div.innerHTML = `
      <span>${filename}</span>
      <div class="progress-bar"><div class="progress-fill" style="width:0%"></div></div>
      <span class="progress-percent">0%</span>
    `;
    this.container.querySelector('.upload-progress').appendChild(div);
    this.items.set(filename, div);
  }
  update(filename, percent) {
    const div = this.items.get(filename);
    if (div) {
      div.querySelector('.progress-fill').style.width = `${percent}%`;
      div.querySelector('.progress-percent').textContent = `${Math.round(percent)}%`;
    }
  }
  complete(filename) {
    const div = this.items.get(filename);
    if (div) {
      div.querySelector('.progress-fill').style.background = 'var(--success)';
      div.querySelector('.progress-percent').textContent = 'Готово';
    }
  }
  hideAfterDelay(ms) {
    setTimeout(() => { if (this.container) this.container.hidden = true; }, ms);
  }
}
export const uploadProgress = new UploadProgress();