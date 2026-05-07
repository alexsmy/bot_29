const SECRET_KEY_WORDS = [
    'api_key', 'apikey', 'api-key', 'token', 'access_token', 'refresh_token', 'id_token',
    'secret', 'client_secret', 'clientsecret', 'password', 'passwd', 'passphrase', 'bearer',
    'session', 'auth', 'authorization', 'private_key', 'privatekey', 'x_api_key', 'x-api-key',
    'x_auth_token', 'x-auth-token', 'cookie', 'sid', 'signature', 'jwt', 'webhook', 'credential'
];

const PLACEHOLDER_WORDS = [
    'example', 'sample', 'demo', 'test', 'placeholder', 'change_me', 'changeme', 'your_', 'your-',
    'dummy', 'fake', 'temp', 'tmp', 'none', 'null', 'undefined', 'todo', 'replace', 'insert', 'fill_me'
];

const PROVIDER_PATTERNS = [
    { id: 'openai', label: 'OpenAI API key', regex: /\bsk-[A-Za-z0-9]{20,}\b/g },
    { id: 'openai-project', label: 'OpenAI project key', regex: /\bproj-[A-Za-z0-9]{20,}\b/g },
    { id: 'github-classic', label: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g },
    { id: 'github-pat', label: 'GitHub PAT', regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
    { id: 'slack', label: 'Slack token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
    { id: 'aws', label: 'AWS access key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { id: 'google', label: 'Google API key', regex: /\bAIza[0-9A-Za-z\-_]{30,}\b/g },
    { id: 'google-oauth', label: 'Google OAuth token', regex: /\bye[a-zA-Z0-9_.-]{20,}\b/g },
    { id: 'jwt', label: 'JWT', regex: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g },
    { id: 'stripe', label: 'Stripe secret key', regex: /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
    { id: 'npm', label: 'npm token', regex: /\bnpm_[A-Za-z0-9]{36,}\b/g },
    { id: 'pypi', label: 'PyPI token', regex: /\bpypi-[A-Za-z0-9-]{20,}\b/g },
    { id: 'datadog', label: 'Datadog API key', regex: /\bdd[a-zA-Z0-9]{32}\b/g },
    { id: 'twilio', label: 'Twilio token', regex: /\bSK[0-9a-fA-F]{32}\b/g },
    { id: 'discord', label: 'Discord token', regex: /\b(?:mfa\.[A-Za-z0-9_-]{20,}|[A-Za-z0-9_-]{23}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27})\b/g }
];

const ASSIGNMENT_REGEX = /(?:^|[\s,{;(])(?:["'`]?)([A-Za-z0-9_.-]{0,80}(?:api[_-]?key|apikey|access[_-]?key|secret|token|password|passphrase|bearer|session|auth|private[_-]?key|refresh[_-]?token|client[_-]?secret|x[_-]?api[_-]?key|id[_-]?token|jwt|cookie|sid|signature|credential)[A-Za-z0-9_.-]{0,80})(?:["'`]?)\s*[:=]\s*(["'`])([^"'`\r\n]{8,512})\3/gi;
const HEADER_REGEX = /\b(?:Authorization|Proxy-Authorization|X-API-KEY|X-Auth-Token|X-Access-Token|Api-Key|Bearer)\b[^\n\r]{0,80}?([A-Za-z0-9\-._~+/=]{16,})/gi;
const PRIVATE_KEY_REGEX = /-----BEGIN [^-]+ PRIVATE KEY-----[\s\S]{32,}?-----END [^-]+ PRIVATE KEY-----/g;

function countNewlines(text, endIndex) {
    let count = 0;
    for (let i = 0; i < endIndex; i += 1) {
        if (text.charCodeAt(i) === 10) count += 1;
    }
    return count;
}

function lineStartIndices(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i += 1) {
        if (text.charCodeAt(i) === 10) starts.push(i + 1);
    }
    return starts;
}

function getLineAtIndex(text, index) {
    const starts = lineStartIndices(text);
    let lineNumber = 1;
    let lineStart = 0;
    for (let i = 0; i < starts.length; i += 1) {
        if (starts[i] <= index) {
            lineNumber = i + 1;
            lineStart = starts[i];
        } else {
            break;
        }
    }
    const lineEnd = text.indexOf('\n', lineStart) === -1 ? text.length : text.indexOf('\n', lineStart);
    return {
        lineNumber,
        lineText: text.slice(lineStart, lineEnd).replace(/\r$/, '').trim()
    };
}

function normalizeText(value) {
    return String(value).trim().replace(/^['"`]+|['"`]+$/g, '');
}

function maskSecretValueInternal(value) {
    const text = String(value || '');
    if (text.length <= 8) return '*****';
    if (/^[\w.-]+$/.test(text) && text.length <= 12) return `${text.slice(0, 2)}…${text.slice(-2)}`;
    return `${text.slice(0, 4)}…${text.slice(-4)}`;
}

function entropyScore(text) {
    const input = String(text || '');
    if (!input) return 0;

    const freq = new Map();
    for (const ch of input) freq.set(ch, (freq.get(ch) || 0) + 1);

    let entropy = 0;
    for (const count of freq.values()) {
        const p = count / input.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function hasMixedCharacterClasses(value) {
    return [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)]
        .filter(Boolean).length;
}

function isPlaceholderValue(value) {
    const lower = String(value || '').toLowerCase();
    return PLACEHOLDER_WORDS.some(word => lower.includes(word));
}

function looksLikeHumanReadableIdentifier(value) {
    const text = String(value || '').trim();
    if (!text) return false;
    if (/[\s]/.test(text)) return false;
    if (!/^[a-z0-9._:-]+$/i.test(text)) return false;
    const words = text.split(/[_\-.:]/).filter(Boolean);
    if (words.length < 2) return false;
    return words.every(word => /^[a-z]+[a-z0-9]*$/i.test(word));
}

function isSecretLikeKeyName(keyName) {
    const lower = String(keyName || '').toLowerCase();
    return SECRET_KEY_WORDS.some(word => lower.includes(word));
}

function charDiversityBonus(value) {
    const classes = hasMixedCharacterClasses(value);
    if (classes >= 4) return 18;
    if (classes === 3) return 12;
    if (classes === 2) return 6;
    return 0;
}

function getProviderMatch(value) {
    for (const pattern of PROVIDER_PATTERNS) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(value);
        if (match) {
            return {
                providerId: pattern.id,
                providerLabel: pattern.label,
                matchedValue: match[0]
            };
        }
    }
    return null;
}

function classifyCandidate({ keyName, value, rawSnippet, filePath, fileIndex, matchIndex, lineNumber, lineText, evidence, providerMatch }) {
    const cleanValue = normalizeText(value);
    const length = cleanValue.length;
    const entropy = entropyScore(cleanValue);
    const diversity = charDiversityBonus(cleanValue);
    const providerBoost = providerMatch ? 100 : 0;
    const keyBoost = isSecretLikeKeyName(keyName) ? 24 : 0;

    let score = providerBoost + keyBoost;

    if (length >= 20) score += 12;
    if (length >= 32) score += 10;
    if (length >= 48) score += 10;
    if (length >= 64) score += 8;

    score += diversity;

    if (entropy >= 3.2 && length >= 16) score += 10;
    if (entropy >= 3.8 && length >= 24) score += 10;
    if (entropy >= 4.2 && length >= 32) score += 8;

    if (/^[A-Za-z0-9+/=_-]+$/.test(cleanValue) && length >= 24) score += 6;

    if (/[\s]/.test(cleanValue)) score -= 15;
    if (looksLikeHumanReadableIdentifier(cleanValue)) score -= 35;
    if (isPlaceholderValue(cleanValue)) score -= 45;
    if (/^[a-z0-9_:-]{8,}$/i.test(cleanValue) && !/[A-Z]/.test(cleanValue) && !/\d/.test(cleanValue) && cleanValue.length < 32) score -= 18;
    if ((cleanValue.match(/(.)\1{4,}/g) || []).length > 0) score -= 12;
    if (!providerMatch && !isSecretLikeKeyName(keyName) && cleanValue.length < 24) score -= 25;
    if (!providerMatch && isSecretLikeKeyName(keyName) && looksLikeHumanReadableIdentifier(cleanValue)) score -= 20;

    const confidence = Math.max(0, Math.min(100, Math.round(score)));
    const severity = confidence >= 85 ? 'critical' : confidence >= 70 ? 'high' : confidence >= 55 ? 'medium' : 'low';
    const selected = confidence >= 70;

    if (!selected) return null;

    const category = providerMatch ? 'provider' : (evidence || 'generic');
    const reasonParts = [];
    if (providerMatch) reasonParts.push(providerMatch.providerLabel);
    if (isSecretLikeKeyName(keyName)) reasonParts.push(`ключ: ${keyName}`);
    if (length >= 32) reasonParts.push(`длина ${length}`);
    if (entropy >= 3.8) reasonParts.push(`энтропия ${entropy.toFixed(2)}`);
    if (!providerMatch && evidence === 'private-key') reasonParts.push('блок приватного ключа');
    if (!providerMatch && evidence === 'header') reasonParts.push('заголовок авторизации');
    if (reasonParts.length === 0) reasonParts.push('высокая уверенность');

    return {
        id: '',
        fileIndex,
        filePath,
        matchIndex,
        fullMatch: rawSnippet,
        prefix: keyName ? `${keyName}:` : '',
        quote: `'`,
        secretValue: cleanValue,
        keyName,
        lineNumber,
        lineText,
        confidence,
        severity,
        category,
        providerId: providerMatch?.providerId || null,
        providerLabel: providerMatch?.providerLabel || null,
        evidence: evidence || (providerMatch ? 'provider' : 'generic'),
        reason: reasonParts.join(' · '),
        selected: true,
        shouldExcludeFile: false,
        snippet: `${keyName ? `${keyName}: ` : ''}${maskSecretValueInternal(cleanValue)}`
    };
}

function addFinding(collection, seenKeys, candidate) {
    if (!candidate) return;
    const key = `${candidate.filePath}::${candidate.lineNumber}::${candidate.secretValue}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    collection.push(candidate);
}

function scanProviderPatterns(content, filePath, fileIndex, findings, seenKeys) {
    for (const pattern of PROVIDER_PATTERNS) {
        pattern.regex.lastIndex = 0;
        let match;
        while ((match = pattern.regex.exec(content)) !== null) {
            const rawValue = match[0];
            const matchInfo = getLineAtIndex(content, match.index);
            const candidate = classifyCandidate({
                keyName: pattern.label,
                value: rawValue,
                rawSnippet: rawValue,
                filePath,
                fileIndex,
                matchIndex: match.index,
                lineNumber: matchInfo.lineNumber,
                lineText: matchInfo.lineText,
                evidence: 'provider',
                providerMatch: {
                    providerId: pattern.id,
                    providerLabel: pattern.label,
                    matchedValue: rawValue
                }
            });
            addFinding(findings, seenKeys, candidate);
        }
    }
}

function scanPrivateKeyBlocks(content, filePath, fileIndex, findings, seenKeys) {
    PRIVATE_KEY_REGEX.lastIndex = 0;
    let match;
    while ((match = PRIVATE_KEY_REGEX.exec(content)) !== null) {
        const rawValue = match[0];
        const lineInfo = getLineAtIndex(content, match.index);
        const candidate = classifyCandidate({
            keyName: 'private_key',
            value: rawValue,
            rawSnippet: rawValue,
            filePath,
            fileIndex,
            matchIndex: match.index,
            lineNumber: lineInfo.lineNumber,
            lineText: lineInfo.lineText,
            evidence: 'private-key',
            providerMatch: null
        });
        addFinding(findings, seenKeys, candidate);
    }
}

function scanHeaders(content, filePath, fileIndex, findings, seenKeys) {
    HEADER_REGEX.lastIndex = 0;
    let match;
    while ((match = HEADER_REGEX.exec(content)) !== null) {
        const rawValue = match[1] || match[0];
        const lineInfo = getLineAtIndex(content, match.index);
        const candidate = classifyCandidate({
            keyName: 'authorization',
            value: rawValue,
            rawSnippet: match[0],
            filePath,
            fileIndex,
            matchIndex: match.index,
            lineNumber: lineInfo.lineNumber,
            lineText: lineInfo.lineText,
            evidence: 'header',
            providerMatch: getProviderMatch(rawValue)
        });
        addFinding(findings, seenKeys, candidate);
    }
}

function scanAssignments(content, filePath, fileIndex, findings, seenKeys) {
    ASSIGNMENT_REGEX.lastIndex = 0;
    let match;
    while ((match = ASSIGNMENT_REGEX.exec(content)) !== null) {
        const keyName = normalizeText(match[1]);
        const value = normalizeText(match[4]);
        const lineInfo = getLineAtIndex(content, match.index);
        const providerMatch = getProviderMatch(value);
        const candidate = classifyCandidate({
            keyName,
            value,
            rawSnippet: match[0],
            filePath,
            fileIndex,
            matchIndex: match.index,
            lineNumber: lineInfo.lineNumber,
            lineText: lineInfo.lineText,
            evidence: 'assignment',
            providerMatch
        });
        addFinding(findings, seenKeys, candidate);
    }
}

export function detectSecretsFromFiles(fileContents = []) {
    const findings = [];
    const seenKeys = new Set();

    fileContents.forEach((file, fileIndex) => {
        const content = String(file?.content || '');
        const filePath = String(file?.path || `file-${fileIndex}`);

        scanProviderPatterns(content, filePath, fileIndex, findings, seenKeys);
        scanPrivateKeyBlocks(content, filePath, fileIndex, findings, seenKeys);
        scanHeaders(content, filePath, fileIndex, findings, seenKeys);
        scanAssignments(content, filePath, fileIndex, findings, seenKeys);
    });

    findings.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
        if (a.lineNumber !== b.lineNumber) return a.lineNumber - b.lineNumber;
        return a.matchIndex - b.matchIndex;
    });

    findings.forEach((finding, index) => {
        finding.id = `sec-${index}`;
    });

    const filesWithFindings = new Map();
    findings.forEach(finding => {
        const entry = filesWithFindings.get(finding.filePath) || { count: 0, maxConfidence: 0, highestSeverity: 'low' };
        entry.count += 1;
        entry.maxConfidence = Math.max(entry.maxConfidence, finding.confidence);
        if (finding.severity === 'critical') entry.highestSeverity = 'critical';
        else if (finding.severity === 'high' && entry.highestSeverity !== 'critical') entry.highestSeverity = 'high';
        else if (finding.severity === 'medium' && !['critical', 'high'].includes(entry.highestSeverity)) entry.highestSeverity = 'medium';
        filesWithFindings.set(finding.filePath, entry);
    });

    const summary = {
        scannedFiles: fileContents.length,
        totalFindings: findings.length,
        filesWithFindings: filesWithFindings.size,
        criticalFindings: findings.filter(item => item.severity === 'critical').length,
        highFindings: findings.filter(item => item.severity === 'high').length,
        mediumFindings: findings.filter(item => item.severity === 'medium').length
    };

    return {
        findings,
        filesWithFindings,
        summary
    };
}

export function maskSecretValue(value) {
    return maskSecretValueInternal(value);
}
