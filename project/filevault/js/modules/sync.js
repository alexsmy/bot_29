// project/filevault/js/modules/sync.js

import { state } from './state.js';
import { fetchDashboard, fetchFolders, fetchFiles, fetchCrptFiles } from '../api.js';
import { syncSelectionWithFiles } from './navigation.js';
import { renderAll, setMessage } from './ui.js';

export async function syncData({ quiet = false } = {}) {
  try {
    const [dashboard, folders, files, crpt] = await Promise.all([
      fetchDashboard(),
      fetchFolders(),
      fetchFiles(),
      fetchCrptFiles()
    ]);
    state.dashboard = dashboard;
    state.folders = Array.isArray(folders) ? folders : [];
    state.files = Array.isArray(files) ? files : [];
    state.crptFiles = Array.isArray(crpt) ? crpt : [];
    syncSelectionWithFiles();
    renderAll();
    if (!quiet) setMessage('Данные обновлены', 'success');
  } catch (error) {
    setMessage(`Ошибка: ${error.message}`, 'error');
  }
}
