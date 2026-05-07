import { DEFAULT_ALLOWED, EXCLUSION_RULES } from './config.js';
import { AI_MODELS } from './ai_models.js';

export const els = {
    folderInput: document.getElementById('folder-input'),
    statusArea: document.getElementById('status-area'),
    loader: document.getElementById('loader'),
    downloadBtn: document.getElementById('final-download-btn'),
    overlay: document.getElementById('modal-overlay'),

    modalExclusions: document.getElementById('modal-exclusions'),
    listExclusions: document.getElementById('list-exclusions'),
    btnCancelExc: document.getElementById('btn-cancel-exc'),
    btnNextExc: document.getElementById('btn-next-exc'),
    btnSettingsExc: document.getElementById('btn-settings-exc'),
    searchExc: document.getElementById('search-exc'),

    modalFinal: document.getElementById('modal-final'),
    listFinal: document.getElementById('list-final'),
    btnBackFinal: document.getElementById('btn-back-final'),
    btnApplySmart: document.getElementById('btn-apply-smart'),
    btnResetSmart: document.getElementById('btn-reset-smart'),
    btnSettingsFinal: document.getElementById('btn-settings-final'),
    searchFin: document.getElementById('search-fin'),
    smartProfileSelect: document.getElementById('smart-profile-select'),
    smartSeedFilesList: document.getElementById('smart-seed-files-list'),
    smartSeedFoldersList: document.getElementById('smart-seed-folders-list'),
    cbSelectAllFiles: document.getElementById('cb-select-all-files'),
    cbSelectAllFolders: document.getElementById('cb-select-all-folders'),
    smartSeedHint: document.getElementById('smart-seed-hint'),
    cbSmartDeps: document.getElementById('cb-smart-deps'),
    cbSmartFolders: document.getElementById('cb-smart-folders'),
    smartFilterSummary: document.getElementById('smart-filter-summary'),
    reviewSummary: document.getElementById('review-summary'),

    modalReview: document.getElementById('modal-review'),
    listReview: document.getElementById('list-review'),
    btnBackReview: document.getElementById('btn-back-review'),
    btnPrepareGen: document.getElementById('btn-prepare-gen'),
    searchReview: document.getElementById('search-review'),

    modalSecrets: document.getElementById('modal-secrets'),
    listSecrets: document.getElementById('list-secrets'),
    btnBackSecrets: document.getElementById('btn-back-secrets'),
    btnExecuteGen: document.getElementById('btn-execute-gen'),
    aiModelSelect: document.getElementById('ai-model-select'),
    cbOptimize: document.getElementById('cb-optimize'),
    cbRepoMap: document.getElementById('cb-repo-map'),
    exportFormatSelect: document.getElementById('export-format-select'),
    secretScanSummary: document.getElementById('secret-scan-summary'),

    modalSettings: document.getElementById('modal-settings'),
    btnCloseSettings: document.getElementById('btn-close-settings'),
    btnApplySettings: document.getElementById('btn-apply-settings'),
    settingsGeneralList: document.getElementById('settings-general-list'),
    settingsIncluded: document.getElementById('settings-included-list'),
    settingsExcluded: document.getElementById('settings-excluded-list'),
    settingsRulesList: document.getElementById('settings-rules-list'),
    settingsAnalysisPackageList: document.getElementById('settings-analysis-package-list'),
    secretsAnalysisPackageList: document.getElementById('secrets-analysis-package-list'),
};

export const state = {
    allFiles: [],
    structureString: '',
    excludedFiles: [],
    acceptedFiles: [],
    allExtensions: new Set(),
    allowedExtensions: new Set(DEFAULT_ALLOWED),
    enabledExclusionRules: new Set(
        EXCLUSION_RULES.filter(rule => rule.enabled !== false).map(rule => rule.id)
    ),
    useGitignore: true,
    excludeLargeFiles: true,
    gitIgnoreSource: '',
    currentStep: 0,
    outputContent: '',
    fileContents: [],
    detectedSecrets: [],
    secretReview: {
        excludedFiles: new Set(),
        filesWithFindings: new Map(),
        summary: null
    },
    gitIgnoreRules: [],
    searchQueryExc: '',
    searchQueryFin: '',
    searchQueryReview: '',
    searchQuerySmart: '',
    selectedAiModel: AI_MODELS[0],
    optimizeCode: false,
    includeRepoMap: true,
    exportFormat: 'markdown',
    analysisPackage: {
        taskContext: true,
        entrypoints: true,
        moduleGraph: true,
        changeScope: true
    },
    finalSelectedPaths: new Set(),
    exclusionSelectedPaths: new Set(),
    smartFilter: {
        profileId: 'auto',
        autoAddDependencies: true,
        autoExpandFolders: true,
        lastResult: null,
        seedFiles: new Set(),
        seedFolders: new Set()
    }
};
