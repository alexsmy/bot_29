const DEFAULT_COMMON_WORDS = new Set([
    'sample', 'example', 'demo', 'placeholder', 'password', 'token', 'secret', 'apikey',
    'api', 'test', 'testing', 'dummy', 'temp', 'temporary', 'none', 'null', 'undefined'
]);

const DEFAULT_VENDOR_PREFIXES = [
    'sk-',
    'sk-proj-',
    'ghp_',
    'github_pat_',
    'xoxb-',
    'xoxp-',
    'xoxa-',
    'xoxr-',
    'ya29.',
    'AIza',
    'AKIA',
    'ASIA',
    'SQ0ATP-',
    'SQ0CSP-',
    'pk_live_',
    'pk_test_',
    'rk_live_',
    'rk_test_',
    'access_token_',
    'Bearer '
];

function shannonEntropy(value) {
    if (!value) return 0;
    const chars = new Map();
    for (const ch of value) {
        chars.set(ch, (chars.get(ch) || 0) + 1);
    }

    let entropy = 0;
    for (const count of chars.values()) {
        const p = count / value.length;
        entropy -= p * Math.log2(p);
    }
    return entropy;
}

function countCharClasses(value) {
    let lower = false;
    let upper = false;
    let digit = false;
    let symbol = false;

    for (const ch of value) {
        if (/[a-z]/.test(ch)) lower = true;
        else if (/[A-Z]/.test(ch)) upper = true;
        else if (/[0-9]/.test(ch)) digit = true;
        else symbol = true;
    }

    return [lower, upper, digit, symbol].filter(Boolean).length;
}

function looksLikeHex(value) {
    return /^[a-f0-9]+$/i.test(value) && value.length >= 24 && value.length % 2 === 0;
}

function looksLikeBase64(value) {
    return value.length >= 20 && /^[A-Za-z0-9+/=_-]+$/.test(value) && /[=/_-]/.test(value);
}

function looksLikeJwt(value) {
    const parts = value.split('.');
    return parts.length === 3 && parts.every(part => part.length >= 8 && /^[A-Za-z0-9_-]+$/.test(part));
}

function hasVendorPrefix(value) {
    const lower = value.toLowerCase();
    return DEFAULT_VENDOR_PREFIXES.some(prefix => lower.startsWith(prefix.toLowerCase()));
}

function looksLikePlaceholder(value) {
    const lower = value.toLowerCase();
    if (DEFAULT_COMMON_WORDS.has(lower)) return true;
    if (/(^|[^a-z])(test|sample|example|demo|dummy|placeholder)([^a-z]|$)/i.test(lower)) return true;
    if (/^(?:1234+|abcd+|qwerty+|asdf+|zxcv+)/i.test(lower)) return true;
    if (/^([a-z])\1{4,}$/i.test(value)) return true;
    return false;
}

function getNameHint(identifier = '', context = '') {
    const merged = `${identifier} ${context}`.toLowerCase();
    return /(api[_-]?key|secret|token|bearer|password|passwd|pwd|auth|session|private[_-]?key|client[_-]?secret|access[_-]?key|refresh[_-]?token|csrf|jwt|sig|signature|credential)/i.test(merged);
}

function scoreCandidate({ value, identifier, context, settings }) {
    const minLength = Number(settings?.minLength ?? 20);
    const minScore = Number(settings?.minScore ?? 4);
    const minEntropy = Number(settings?.minEntropy ?? 3.0);
    const requireNameHint = settings?.requireNameHint !== false;

    const trimmed = String(value || '').trim();
    if (!trimmed) return { score: -100, reason: 'empty' };

    const hasNameHint = getNameHint(identifier, context);
    const vendor = hasVendorPrefix(trimmed);
    const jwt = looksLikeJwt(trimmed);
    const hex = looksLikeHex(trimmed);
    const base64 = looksLikeBase64(trimmed);
    const entropy = shannonEntropy(trimmed);
    const classes = countCharClasses(trimmed);

    let score = 0;
    const reasons = [];

    if (vendor) {
        score += 6;
        reasons.push('vendor-prefix');
    }

    if (jwt) {
        score += 6;
        reasons.push('jwt');
    }

    if (hex) {
        score += 4;
        reasons.push('hex');
    }

    if (base64) {
        score += 3;
        reasons.push('base64');
    }

    if (trimmed.length >= minLength) {
        score += 2;
        reasons.push('length');
    } else if (!vendor && !jwt && !hex) {
        score -= 3;
    }

    if (classes >= 3) {
        score += 2;
        reasons.push('diverse-chars');
    }

    if (entropy >= minEntropy) {
        score += 2;
        reasons.push('entropy');
    }

    if (/[A-Z]/.test(trimmed) && /[a-z]/.test(trimmed)) {
        score += 1;
    }

    if (/[0-9]/.test(trimmed)) {
        score += 1;
    }

    if (/[-_=/+]/.test(trimmed)) {
        score += 1;
    }

    if (hasNameHint) {
        score += 2;
        reasons.push('name-hint');
    }

    if (looksLikePlaceholder(trimmed)) {
        score -= 5;
        reasons.push('placeholder');
    }

    if (/(test|sample|dummy|placeholder)/i.test(identifier) && !hasNameHint) {
        score -= 2;
    }

    if (requireNameHint && !hasNameHint && score < minScore + 2 && !vendor && !jwt && !hex) {
        score -= 3;
        reasons.push('no-name-hint');
    }

    return { score, reasons, hasNameHint, vendor, jwt, hex, base64, entropy, classes, minLength, minScore };
}

function buildPreview(value, keepStart = 4, keepEnd = 4) {
    const text = String(value || '');
    if (text.length <= keepStart + keepEnd + 2) return '••••••';
    return `${text.slice(0, keepStart)}…${text.slice(-keepEnd)}`;
}

function extractQuotableCandidates(line) {
    const matches = [];
    const regex = /(["'`])([^"'`]{8,})\1/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        matches.push({
            value: match[2],
            start: match.index,
            end: match.index + match[0].length,
            quote: match[1]
        });
    }
    return matches;
}

function extractAssignmentIdentifier(line, startIndex) {
    const left = line.slice(0, startIndex);
    const patterns = [
        /([A-Za-z0-9_.-]{2,})\s*[:=]\s*$/,
        /(?:const|let|var)\s+([A-Za-z0-9_.-]{2,})\s*=\s*$/,
        /(?:public|private|protected|static|final|readonly)?\s*([A-Za-z0-9_.-]{2,})\s*=\s*$/
    ];

    for (const pattern of patterns) {
        const match = left.match(pattern);
        if (match) return match[1];
    }

    return '';
}

function extractEnvAssignments(line) {
    const results = [];
    const regex = /\b([A-Z0-9_]{2,})\s*=\s*([^#\s]+(?:\s+[^#\s]+)*)/g;
    let match;
    while ((match = regex.exec(line)) !== null) {
        let raw = match[2].trim();
        raw = raw.replace(/[;,\s]+$/, '');
        if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('`') && raw.endsWith('`'))) {
            raw = raw.slice(1, -1);
        }
        results.push({ identifier: match[1], value: raw, start: match.index + match[0].indexOf(match[2]) });
    }
    return results;
}

export function detectSecretsInFiles(fileContents, settings = {}) {
    const findings = [];

    fileContents.forEach((file, fileIndex) => {
        const content = String(file.content || '');
        const lines = content.split(/\r?\n/);
        let lineCursor = 0;

        lines.forEach((line, lineIndex) => {
            const lineCandidates = [];

            extractEnvAssignments(line).forEach(item => {
                lineCandidates.push({
                    ...item,
                    context: line,
                    quote: '',
                    kind: 'env'
                });
            });

            extractQuotableCandidates(line).forEach(item => {
                const identifier = extractAssignmentIdentifier(line, item.start);
                lineCandidates.push({
                    identifier,
                    value: item.value,
                    context: line,
                    quote: item.quote,
                    kind: 'quoted'
                });
            });

            lineCandidates.forEach(candidate => {
                const analysis = scoreCandidate({
                    value: candidate.value,
                    identifier: candidate.identifier,
                    context: candidate.context,
                    settings
                });

                const strongSignal = analysis.vendor || analysis.jwt || analysis.hex || analysis.base64 || analysis.hasNameHint;
                const enoughScore = analysis.score >= Number(settings?.minScore ?? 4);
                const accepted = strongSignal ? enoughScore : (analysis.score >= Number(settings?.minScore ?? 4) + 2);

                if (!accepted) return;

                const fullMatch = candidate.kind === 'env'
                    ? `${candidate.identifier}=${candidate.value}`
                    : `${candidate.quote}${candidate.value}${candidate.quote}`;

                const prefix = candidate.kind === 'env'
                    ? `${candidate.identifier}=`
                    : '';
                const quote = candidate.quote || '';
                const absoluteIndex = lineCursor + (typeof candidate.start === 'number' ? candidate.start : 0);

                findings.push({
                    id: `sec-${fileIndex}-${lineIndex}-${findings.length}`,
                    fileIndex,
                    filePath: file.path,
                    lineNumber: lineIndex + 1,
                    matchIndex: absoluteIndex,
                    fullMatch,
                    prefix,
                    quote,
                    secretValue: candidate.value,
                    selected: true,
                    score: analysis.score,
                    reasons: analysis.reasons,
                    preview: buildPreview(candidate.value)
                });
            });
            lineCursor += line.length + 1;
        });
    });

    return findings
        .filter(item => item.secretValue && item.secretValue.length >= Number(settings?.minLength ?? 20))
        .sort((a, b) => b.score - a.score || a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber);
}

export function maskSecretPreview(secretValue) {
    return buildPreview(secretValue);
}
