import { EXCLUSION_RULES, MAX_FILE_SIZE_MB } from './config.js';
import { els, state } from './state.js';
import { getExtension, readFile, buildFileTree, generateStructureString } from './utils.js';
import { parseGitignore, isIgnoredByGit } from './gitignore.js';
import { resetUI, switchStep } from './ui_core.js';
import { saveAppSettings, applyTheme } from './settings_store.js';

export async function processFolder(files) {
    state.allFiles = files;
    if (state.allFiles.length === 0) return;

    resetUI();
    els.loader.style.display = 'block';
    els.statusArea.style.display = 'block';
    els.statusArea.innerHTML = `Анализ структуры из ${state.allFiles.length} файлов...`;

    state.gitIgnoreRules = [];
    state.gitIgnoreSource = '';

    const gitignoreFile = state.allFiles.find(
        f => f.name === '.gitignore' && f.webkitRelativePath.split('/').length === 2
    );

    if (gitignoreFile) {
        try {
            const gitignoreData = await readFile(gitignoreFile);
            state.gitIgnoreSource = gitignoreData.content || '';
            if (state.useGitignore) {
                state.gitIgnoreRules = parseGitignore(gitignoreData.content);
            }
            console.log(`Загружен .gitignore: ${state.gitIgnoreRules.length} правил`);
        } catch (e) {
            console.error('Ошибка чтения .gitignore', e);
        }
    }

    const structureObjects = state.allFiles.map(file => ({ path: file.webkitRelativePath }));
    const tree = buildFileTree(structureObjects);
    state.structureString = generateStructureString(tree);

    findAllExtensions();
    categorizeFiles();

    els.loader.style.display = 'none';
    switchStep(1);
}

export function findAllExtensions() {
    state.allExtensions.clear();
    state.allFiles.forEach(file => {
        const ext = getExtension(file.name);
        if (ext) state.allExtensions.add(ext);
    });
}

function findMatchingRule(fileInfo) {
    const enabledRules = EXCLUSION_RULES.filter(rule => state.enabledExclusionRules.has(rule.id));
    return enabledRules.find(rule => rule.match(fileInfo)) || null;
}

export function categorizeFiles() {
    state.acceptedFiles = [];
    state.excludedFiles = [];
    state.finalSelectedPaths = new Set();
    state.exclusionSelectedPaths = new Set();
    state.smartFilter.lastResult = null;
    state.smartFilter.seedFiles.clear();
    state.smartFilter.seedFolders.clear();

    const maxSizeMb = Number(state.appSettings.maxFileSizeMb || MAX_FILE_SIZE_MB);
    const maxSizeBytes = maxSizeMb * 1024 * 1024;

    for (let file of state.allFiles) {
        const ext = getExtension(file.name);
        const fileInfo = {
            path: file.webkitRelativePath,
            name: file.name,
            originalFile: file,
            reason: '',
            reasonLabel: ''
        };

        if (state.excludeLargeFiles && file.size > maxSizeBytes) {
            fileInfo.reason = 'size';
            fileInfo.reasonLabel = `> ${maxSizeMb}MB`;
            state.excludedFiles.push(fileInfo);
            continue;
        }

        if (state.useGitignore && state.gitIgnoreRules.length > 0 && isIgnoredByGit(fileInfo.path, state.gitIgnoreRules)) {
            fileInfo.reason = 'git';
            fileInfo.reasonLabel = '.gitignore';
            state.excludedFiles.push(fileInfo);
            continue;
        }

        const isAllowedExt = state.allowedExtensions.has(ext);
        const matchedRule = findMatchingRule(fileInfo);

        if (isAllowedExt && !matchedRule) {
            state.acceptedFiles.push(fileInfo);
        } else {
            fileInfo.reason = matchedRule ? `rule:${matchedRule.id}` : 'rule';
            fileInfo.reasonLabel = matchedRule ? matchedRule.label : 'Правила/расширение';
            state.excludedFiles.push(fileInfo);
        }
    }
}

export function applyExclusions(rescuedPaths = new Set()) {
    const rescued = rescuedPaths instanceof Set ? rescuedPaths : new Set(rescuedPaths);
    state.finalSelectedPaths = new Set(state.acceptedFiles.map(f => f.path));

    state.excludedFiles.forEach(file => {
        if (rescued.has(file.path)) {
            state.finalSelectedPaths.add(file.path);
        }
    });

    state.smartFilter.lastResult = null;
}

export function applySettings(controls) {
    const nextAllowed = new Set(state.allowedExtensions);
    const nextRules = new Set(state.enabledExclusionRules);

    let nextUseGitignore = state.useGitignore;
    let nextExcludeLargeFiles = state.excludeLargeFiles;
    const nextAppSettings = {
        ...state.appSettings,
        secretDetection: {
            ...state.appSettings.secretDetection
        }
    };

    controls.forEach(control => {
        const kind = control.dataset?.kind;
        const setting = control.dataset?.setting;

        if (kind === 'extension') {
            if (control.checked) nextAllowed.add(control.value);
            return;
        }

        if (kind === 'rule') {
            if (control.checked) nextRules.add(control.value);
            return;
        }

        if (kind === 'general') {
            if (control.value === 'use-gitignore') {
                nextUseGitignore = control.checked;
            }
            if (control.value === 'exclude-large-files') {
                nextExcludeLargeFiles = control.checked;
            }
            return;
        }

        if (kind === 'appearance') {
            if (setting === 'theme') {
                nextAppSettings.theme = control.checked ? 'dark' : 'light';
            }
            return;
        }

        if (kind === 'limit') {
            if (setting === 'maxFileSizeMb') {
                const parsed = Number(control.value);
                if (Number.isFinite(parsed) && parsed > 0) {
                    nextAppSettings.maxFileSizeMb = parsed;
                }
            }
            return;
        }

        if (kind === 'secret') {
            if (setting === 'minLength') {
                const parsed = Number(control.value);
                if (Number.isFinite(parsed) && parsed >= 8) {
                    nextAppSettings.secretDetection.minLength = parsed;
                }
            } else if (setting === 'minScore') {
                const parsed = Number(control.value);
                if (Number.isFinite(parsed) && parsed >= 1) {
                    nextAppSettings.secretDetection.minScore = parsed;
                }
            } else if (setting === 'minEntropy') {
                const parsed = Number(control.value);
                if (Number.isFinite(parsed) && parsed >= 0) {
                    nextAppSettings.secretDetection.minEntropy = parsed;
                }
            } else if (setting === 'requireNameHint') {
                nextAppSettings.secretDetection.requireNameHint = control.checked;
            }
            return;
        }

        if (kind === 'analysis-package') {
            if (Object.prototype.hasOwnProperty.call(state.analysisPackage, control.value)) {
                state.analysisPackage[control.value] = control.checked;
            }
        }
    });

    state.allowedExtensions = nextAllowed;
    state.enabledExclusionRules = nextRules;
    state.useGitignore = nextUseGitignore;
    state.excludeLargeFiles = nextExcludeLargeFiles;
    state.appSettings = nextAppSettings;

    applyTheme(nextAppSettings.theme);
    saveAppSettings({
        ...nextAppSettings,
        useGitignore: state.useGitignore,
        excludeLargeFiles: state.excludeLargeFiles
    });

    if (state.useGitignore && !state.gitIgnoreRules.length && state.gitIgnoreSource) {
        state.gitIgnoreRules = parseGitignore(state.gitIgnoreSource);
    }

    categorizeFiles();
    state.smartFilter.lastResult = null;

    els.modalSettings.style.display = 'none';
    if (els.overlay) els.overlay.style.display = 'none';
    switchStep(state.currentStep);
}
