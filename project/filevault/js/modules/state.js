// project/filevault/js/modules/state.js

export const state = {
  files: [],
  folders: [],
  dashboard: null,
  currentFolderId: null,
  activeFileId: null,
  selectedFileIds: new Set(),
  query: '',
  sort: 'date-desc',
  viewMode: 'grid',
  pond: null,
  busy: false,
  dialogAction: null,
  crptFiles: [],
};

export const elements = {};

export function cacheElements() {
  elements.form = document.getElementById('uploadForm');
  elements.input = document.getElementById('fileInput');
  elements.uploadButton = document.getElementById('uploadButton');
  elements.clearUploadButton = document.getElementById('clearUploadButton');
  elements.refreshButton = document.getElementById('refreshButton');
  elements.searchInput = document.getElementById('searchInput');
  elements.sortSelect = document.getElementById('sortSelect');
  elements.filesList = document.getElementById('filesList');
  elements.detailsPanel = document.getElementById('detailsPanel');
  elements.bulkBar = document.getElementById('bulkBar');
  elements.bulkSummary = document.getElementById('bulkSummary');
  elements.bulkMoveButton = document.getElementById('bulkMoveButton');
  elements.bulkDeleteButton = document.getElementById('bulkDeleteButton');
  elements.bulkClearButton = document.getElementById('bulkClearButton');
  elements.folderTree = document.getElementById('folderTree');
  elements.currentFolderLabel = document.getElementById('currentFolderLabel');
  elements.uploadFolderLabel = document.getElementById('uploadFolderLabel');
  elements.createFolderButton = document.getElementById('createFolderButton');
  elements.renameFolderButton = document.getElementById('renameFolderButton');
  elements.deleteFolderButton = document.getElementById('deleteFolderButton');
  elements.folderRefreshButton = document.getElementById('folderRefreshButton');
  elements.messageBox = document.getElementById('messageBox');
  elements.dashboardFiles = document.getElementById('dashboardFiles');
  elements.dashboardFolders = document.getElementById('dashboardFolders');
  elements.dashboardUsed = document.getElementById('dashboardUsed');
  elements.dashboardFree = document.getElementById('dashboardFree');
  elements.dashboardTotal = document.getElementById('dashboardTotal');
  elements.actionDialog = document.getElementById('actionDialog');
  elements.actionDialogForm = document.getElementById('actionDialogForm');
  elements.actionDialogTitle = document.getElementById('actionDialogTitle');
  elements.actionDialogSubtitle = document.getElementById('actionDialogSubtitle');
  elements.actionDialogBody = document.getElementById('actionDialogBody');
  elements.actionDialogConfirm = document.getElementById('actionDialogConfirm');
  elements.actionDialogClose = document.getElementById('actionDialogClose');
  elements.actionDialogCancelButton = document.getElementById('actionDialogCancelButton');
  elements.uploadProgressContainer = document.getElementById('uploadProgressContainer');
}

export function normalizeFolderId(folderId) {
  return folderId ? String(folderId) : null;
}

export function getCurrentFolderNode(nodes = state.folders, folderId = state.currentFolderId) {
  if (folderId === null || folderId === '') {
    return { folder_id: null, name: 'Корень хранилища', path: 'Корень хранилища' };
  }
  for (const node of nodes) {
    if ((node.folder_id ?? null) === folderId) return node;
    const children = Array.isArray(node.children) ? node.children : [];
    const match = getCurrentFolderNode(children, folderId);
    if (match) return match;
  }
  return null;
}

export function getCurrentFolderLabel() {
  return getCurrentFolderNode()?.path || 'Корень хранилища';
}
