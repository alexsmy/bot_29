

import { EXCLUSION_RULES, MAX_FILE_SIZE_MB } from './config.js';
import { els, state } from './state.js';
import { getExtension, readFile, buildFileTree, generateStructureString } from './utils.js';
import { parseGitignore, isIgnoredByGit } from './gitignore.js';
import { resetUI, switchStep } from './ui_core.js';

export async function processFolder(files) {
    state.allFiles = files;
    if (state.allFiles.length === 0) return;

    resetUI();
    state.generationResult = null;
    if (els.modalExclusions) els.modalExclusions.style.display = 'none';
    if (els.modalFinal) els.modalFinal.style.display = 'none';
    if (els.modalReview) els.modalReview.style.display = 'none';
    if (els.modalSecrets) els.modalSecrets.style.display = 'none';
    if (els.modalFinalize) els.modalFinalize.style.display = 'none';
    if (els.modalResult) els.modalResult.style.display = 'none';
    if (els.modalSettings) els.modalSettings.style.display = 'none';
    if (els.overlay) els.overlay.style.display = 'none';
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
    state.detectedSecrets = [];
    state.secretReview = { excludedFiles: new Set(), filesWithFindings: new Map(), summary: null };
    state.smartFilter.lastResult = null;
    state.smartFilter.seedFiles.clear();
    state.smartFilter.seedFolders.clear();

    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

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
            fileInfo.reasonLabel = `> ${MAX_FILE_SIZE_MB}MB`;
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

export function applyExclusions(rescuedPaths) {
    const rescuedSet = rescuedPaths instanceof Set ? rescuedPaths : new Set(rescuedPaths);
    const newExcluded = [];
    const acceptedPaths = new Set(state.acceptedFiles.map(f => f.path));

    state.excludedFiles.forEach(f => {
        if (rescuedSet.has(f.path)) {
            if (!acceptedPaths.has(f.path)) {
                state.acceptedFiles.push(f);
                acceptedPaths.add(f.path);
            }
            state.exclusionSelectedPaths.add(f.path);
        } else {
            newExcluded.push(f);
        }
    });

    state.excludedFiles = newExcluded;
    state.smartFilter.lastResult = null;
}

export function applySettings(checkboxes) {
    const nextAllowed = new Set();
    const nextRules = new Set();

    let nextUseGitignore = state.useGitignore;
    let nextExcludeLargeFiles = state.excludeLargeFiles;

    checkboxes.forEach(cb => {
        if (cb.dataset.kind === 'extension') {
            if (cb.checked) {
                nextAllowed.add(cb.value);
            }
            return;
        }

        if (cb.dataset.kind === 'rule') {
            if (cb.checked) {
                nextRules.add(cb.value);
            }
            return;
        }

        if (cb.dataset.kind === 'general') {
            if (cb.value === 'use-gitignore') {
                nextUseGitignore = cb.checked;
            }
            if (cb.value === 'exclude-large-files') {
                nextExcludeLargeFiles = cb.checked;
            }
            return;
        }

        if (cb.dataset.kind === 'analysis-package') {
            if (Object.prototype.hasOwnProperty.call(state.analysisPackage, cb.value)) {
                state.analysisPackage[cb.value] = cb.checked;
            }
        }
    });

    state.allowedExtensions = nextAllowed;
    state.enabledExclusionRules = nextRules;
    state.useGitignore = nextUseGitignore;
    state.excludeLargeFiles = nextExcludeLargeFiles;

    if (state.useGitignore && !state.gitIgnoreRules.length && state.gitIgnoreSource) {
        state.gitIgnoreRules = parseGitignore(state.gitIgnoreSource);
    }

    categorizeFiles();
    state.smartFilter.lastResult = null;

    els.modalSettings.style.display = 'none';
    switchStep(state.currentStep);
}

    