import { SMART_PROFILE_MAP } from './constants.js';
import { normalizePath, getPathExtension, findPoolPath } from './path_utils.js';
import { collectDependencies } from './dependency_parser.js';
import { inferSmartProfile } from './profile_inference.js';
import { buildSummaryHtml } from './ui_generators.js';

function expandFolderPaths(folderPaths, acceptedFiles) {
    const expanded = new Set();
    const folders = Array.from(folderPaths ||[]).map(normalizePath).filter(Boolean);

    if (folders.length === 0) return expanded;

    acceptedFiles.forEach(file => {
        const normalized = normalizePath(file.path);
        for (const folder of folders) {
            if (normalized === folder || normalized.startsWith(`${folder}/`)) {
                expanded.add(normalized);
                break;
            }
        }
    });

    return expanded;
}

function filterRelevantPaths(paths, profile, poolMap) {
    if (!profile.pruneNonRelevant || !profile.preferredExtensions || profile.preferredExtensions.length === 0) {
        return new Set(paths);
    }

    const finalPaths = new Set();
    for (const path of paths) {
        const fileInfo = poolMap.get(normalizePath(path));
        const ext = getPathExtension(path);
        if (profile.preferredExtensions.includes(ext) || (fileInfo && profile.preferredExtensions.includes(getPathExtension(fileInfo.path)))) {
            finalPaths.add(normalizePath(path));
        }
    }
    return finalPaths;
}

export function getSmartProfileById(profileId) {
    return SMART_PROFILE_MAP[profileId] || SMART_PROFILE_MAP.auto;
}

export function getSmartSeedMode(profileId) {
    return getSmartProfileById(profileId).seedMode || 'mixed';
}

export function getProjectFolders(acceptedFiles =[]) {
    const counts = new Map();

    acceptedFiles.forEach(file => {
        const path = normalizePath(file.path);
        const parts = path.split('/');
        if (parts.length < 2) return;

        for (let i = 0; i < parts.length - 1; i++) {
            const folder = parts.slice(0, i + 1).join('/');
            counts.set(folder, (counts.get(folder) || 0) + 1);
        }
    });

    return Array.from(counts.entries())
        .map(([path, fileCount]) => ({ path, fileCount }))
        .sort((a, b) => {
            const depthDiff = a.path.split('/').length - b.path.split('/').length;
            if (depthDiff !== 0) return depthDiff;
            return a.path.localeCompare(b.path);
        });
}

export function getProjectSeedSuggestions(acceptedFiles =[], profileId = 'auto') {
    const profile = getSmartProfileById(profileId);
    const folders = getProjectFolders(acceptedFiles);
    const fileOptions = acceptedFiles.slice().sort((a, b) => a.path.localeCompare(b.path));
    return { profile, fileOptions, folderOptions: folders };
}

export async function buildSmartSelection({
    seedFiles = [],
    seedFolders = [],
    acceptedFiles =[],
    profileId = 'auto',
    autoAddDependencies = true,
    autoExpandFolders = true
} = {}) {
    const cleanSeedFiles = Array.from(new Set(seedFiles.map(normalizePath))).filter(Boolean);
    const cleanSeedFolders = Array.from(new Set(seedFolders.map(normalizePath))).filter(Boolean);

    const poolMap = new Map();
    const lowerMap = new Map();

    acceptedFiles.forEach(file => {
        const key = normalizePath(file.path);
        poolMap.set(key, file);
        lowerMap.set(key.toLowerCase(), key);
    });

    const inferredProfileId = profileId === 'auto'
        ? inferSmartProfile(cleanSeedFiles, cleanSeedFolders, poolMap)
        : profileId;

    const profile = getSmartProfileById(inferredProfileId);
    const profileLabel = profileId === 'auto' && inferredProfileId !== 'auto'
        ? `Авто → ${profile.name}`
        : profile.name;

    const seedFileSet = new Set(
        cleanSeedFiles.filter(path => findPoolPath(path, poolMap, lowerMap))
    );
    const seedFolderSet = new Set(cleanSeedFolders.filter(Boolean));

    const folderExpandedPaths = autoExpandFolders && profile.folderAware
        ? expandFolderPaths(seedFolderSet, acceptedFiles)
        : new Set();

    const initialPaths = new Set([...seedFileSet, ...folderExpandedPaths]);

    const dependencyResult = autoAddDependencies
        ? await collectDependencies([...initialPaths], poolMap, lowerMap)
        : { paths: new Set(), details:[] };

    const dependencyPaths = dependencyResult.paths;
    const dependencyDetails = dependencyResult.details;

    const dependencyFiltered = profile.pruneNonRelevant
        ? filterRelevantPaths(dependencyPaths, profile, poolMap)
        : new Set(dependencyPaths);

    const finalPaths = new Set([...initialPaths, ...dependencyFiltered]);
    const prunedCount = Math.max(0, dependencyPaths.size - dependencyFiltered.size);

    const summaryHtml = buildSummaryHtml({
        profileLabel,
        seedFiles: cleanSeedFiles,
        seedFolders: cleanSeedFolders,
        folderExpandedCount: folderExpandedPaths.size,
        dependencyPaths,
        finalPaths,
        prunedCount,
        dependencyDetails
    });

    return {
        requestedProfileId: profileId,
        profileId: inferredProfileId,
        profile,
        profileLabel,
        seedFiles: new Set(cleanSeedFiles),
        seedFolders: new Set(cleanSeedFolders),
        folderExpandedPaths,
        dependencyPaths,
        dependencyDetails,
        finalPaths,
        summaryHtml,
        autoAddDependencies,
        autoExpandFolders,
        folderExpandedCount: folderExpandedPaths.size,
        dependencyCount: dependencyPaths.size,
        prunedCount
    };
}