// project/filevault/js/modules/file-operations.js

import { state, elements } from './state.js';
import { clearFileSelection } from './navigation.js';
import { setMessage, hideMessage, setBusy, renderAll } from './ui.js';
import { uploadFiles, updateFile, moveFiles, deleteFiles, deleteCrptFile } from '../api.js';
import { uploadProgress } from '../upload-progress.js';
import { syncData } from './sync.js';

export async function handleUpload(event) {
  event.preventDefault();
  const files = state.pond ? state.pond.getFiles().map(f => f.file).filter(Boolean) : Array.from(elements.input.files || []);
  if (!files.length) { setMessage('Выберите файлы', 'error'); return; }
  setBusy(true);
  hideMessage();
  uploadProgress.show(elements.uploadProgressContainer);
  try {
    for (const file of files) {
      uploadProgress.addFile(file.name);
      await uploadFiles([file], state.currentFolderId === '__crpt__' ? null : state.currentFolderId, (progress) => uploadProgress.update(file.name, progress));
      uploadProgress.complete(file.name);
    }
    uploadProgress.hideAfterDelay(2000);
    await syncData({ quiet: true });
    setMessage(`Загружено файлов: ${files.length}`, 'success');
    if (state.pond) state.pond.removeFiles();
    else elements.input.value = '';
  } catch (error) {
    setMessage(`Ошибка загрузки: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}

export function openRenameFileDialog(fileId) {
  const file = state.files.find(f => f.file_id === fileId);
  if (!file) return;
  const newName = prompt('Новое имя файла', file.original_name);
  if (!newName) return;
  setBusy(true);
  updateFile(fileId, { original_name: newName }).then(() => syncData({ quiet: true })).finally(() => setBusy(false));
}

export function openMoveFileDialog(fileIds) {
  const folderId = prompt('ID папки назначения (оставьте пустым для корня)');
  setBusy(true);
  moveFiles(fileIds, folderId || null).then(() => { clearFileSelection(); return syncData({ quiet: true }); }).finally(() => setBusy(false));
}

export function confirmDeleteFiles(fileIds, message) {
  if (!confirm(message)) return;
  setBusy(true);
  deleteFiles(fileIds).then(() => { clearFileSelection(); return syncData({ quiet: true }); }).finally(() => setBusy(false));
}

export async function confirmDeleteCrptFile(crptId) {
  setBusy(true);
  try {
    await deleteCrptFile(crptId);
    await syncData({ quiet: true });
    setMessage('Файл удалён из CRPT Cloud', 'success');
  } catch (error) {
    setMessage(`Ошибка удаления: ${error.message}`, 'error');
  } finally {
    setBusy(false);
  }
}
