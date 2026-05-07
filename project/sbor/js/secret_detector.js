const SECRET_NAME_HINTS = [
    'api', 'apikey', 'api_key', 'api-key',
    'token', 'access', 'access_token', 'access-token',
    'refresh', 'refresh_token', 'refresh-token',
    'secret', 'clientsecret', 'client_secret', 'client-secret',
    'private', 'private_key', 'private-key',
    'password', 'passwd', 'passphrase',
    'auth', 'authorization', 'bearer',
    'session', 'sessionid', 'session_id',
    'cookie', 'csrf', 'xsrf',
    'webhook', 'signature', 'credential', 'credentials',
    'stripe', 'github', 'gitlab', 'slack', 'discord', 'firebase', 'supabase'
];

const PLACEHOLDER_VALUES = new Set([
    'testtoken', 'test_token', 'sampletoken', 'sample_token',
    'placeholder', 'place_holder', 'changeme', 'change_me',
    'replace_me', 'replaceme', 'dummy', 'example', 'exampletoken',
    'your_token_here', 'your_api_key_here', 'your_secret_here',
    'todo', 'lorem', 'ipsum', 'token', 'secret', 'password',
    'null', 'undefined', 'none', 'false', 'true', '0', '1'
]);

const KNOWN_PREFIX_RULES = [
    { prefix: 'AKIA', label: 'AWS access key', minLength: 20, exact: /^AKIA[0-9A-Z]{16}$/ },
    { prefix: 'ASIA', label: 'AWS temporary key', minLength: 20, exact: /^ASIA[0-9A-Z]{16}$/ },
    { prefix: 'A3T', label: 'AWS legacy key', minLength: 20, exact: /^A3T[A-Z0-9]{17}$/ },
    { prefix: 'ghp_', label: 'GitHub personal token', minLength: 20, exact: /^ghp_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'gho_', label: 'GitHub OAuth token', minLength: 20, exact: /^gho_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'ghu_', label: 'GitHub user token', minLength: 20, exact: /^ghu_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'ghs_', label: 'GitHub server token', minLength: 20, exact: /^ghs_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'ghr_', label: 'GitHub refresh token', minLength: 20, exact: /^ghr_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'github_pat_', label: 'GitHub PAT', minLength: 20, exact: /^github_pat_[A-Za-z0-9_]{20,}$/ },
    { prefix: 'xoxb-', label: 'Slack bot token', minLength: 20, exact: /^xox[baprs]-[A-Za-z0-9-]{10,}$/ },
    { prefix: 'xoxp-', label: 'Slack user token', minLength: 20, exact: /^xoxp-[A-Za-z0-9-]{10,}$/ },
    { prefix: 'xoxa-', label: 'Slack legacy token', minLength: 20, exact: /^xoxa-[A-Za-z0-9-]{10,}$/ },
    { prefix: 'sk-', label: 'Secret key', minLength: 20, exact: /^sk-[A-Za-z0-9]{16,}$/ },
    { prefix: 'rk_', label: 'Restricted key', minLength: 20, exact: /^rk_[A-Za-z0-9]{16,}$/ },
    { prefix: 'eyJ', label: 'JWT', minLength: 24, exact: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/ }
];

const LINE_PATTERNS = [
    {
        kind: 'assignment',
        regex: /(\b(?:export\s+)?(?:const|let|var)\s+[A-Za-z0-9_$.-]{1,80}\s*=\s*)(['"`])([^'"`\r\n]{4,})\2/g,
    },
    {
        kind: 'object',
        regex: /((?:['"][^'"\r\n]{1,80}['"]|[A-Za-z0-9_$.-]{1,80})\s*[:=]\s*)(['"`])([^'"`\r\n]{4,})\2/g,
    },
    {
        kind: 'env',
        regex: /(\b[A-Z0-9_]{2,}\s*=\s*)(['"`])([^'"`\r\n]{4,})\2/g,
    },
    {
        kind: 'bare',
        regex: /(\b(?:[A-Z][A-Z0-9_]{1,40}|[A-Za-z0-9_$.-]{1,40}(?:token|secret|key|password|auth|session|cookie|webhook)[A-Za-z0-9_$.-]*)\s*[:=]\s*)([A-Za-z0-9._~+/=-]{8,})/g,
    },
    {
        kind: 'auth-header',
        regex: /(Authorization\s*:\s*Bearer\s+)([A-Za-z0-9._~+/=-]{16,})/gi,
    },
    {
        kind: 'url-param',
        regex: /([?&](?:access[_-]?token|api[_-]?key|token|secret|password|auth|session|signature)=)([^&#\s'"`]{8,})/gi,
    }
];

function normalizeText(value) {
    return String(value ?? '').trim();
}

function stripQuotes(value) {
    const text = normalizeText(value);
    if (!text) return '';
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")) || (text.startsWith('`') && text.endsWith('`'))) {
        return text.slice(1, -1);
    }
    return text;
}

function hasSecretName(name) {
    const lower = normalizeText(name).toLowerCase();
    if (!lower) return false;
    return SECRET_NAME_HINTS.some(token => lower.includes(token));
}

function isPlaceholderValue(value) {
    const lower = stripQuotes(value).toLowerCase();
    if (!lower) return true;
    if (PLACEHOLDER_VALUES.has(lower)) return true;
    if (/^(?:x+|0+|a+|b+|c+|d+|1+|2+|3+|4+|5+|6+|7+|8+|9+)$/.test(lower)) return true;
    if (/^(?:test|sample|demo|example|placeholder)[-_a-z0-9]*$/i.test(lower)) return true;
    return false;
}

function classifyCharacterClasses(value) {
    const classes = new Set();
    for (const char of value) {
        if (/[a-z]/.test(char)) classes.add('lower');
        else if (/[A-Z]/.test(char)) classes.add('upper');
        else if (/[0-9]/.test(char)) classes.add('digit');
        else if (/[^\w\s]/.test(char)) classes.add('symbol');
    }
    return classes.size;
}

function looksBase64Url(value) {
    return /^[A-Za-z0-9_-]{20,}={0,2}$/.test(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
}

function looksHex(value) {
    return /^[0-9a-fA-F]{24,}$/.test(value) && value.length % 2 === 0;
}

function looksJwt(value) {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    return parts.every(part => /^[A-Za-z0-9_-]{8,}$/.test(part));
}

function knownPrefixMatch(value) {
    for (const rule of KNOWN_PREFIX_RULES) {
        if (rule.exact.test(value)) {
            return rule;
        }
        if (value.startsWith(rule.prefix) && value.length >= rule.minLength) {
            return rule;
        }
    }
    return null;
}

function scoreCandidate({ name, value, kind }) {
    const cleanValue = stripQuotes(value);
    const cleanName = normalizeText(name);
    let score = 0;
    const reasons = [];
    let category = 'generic';

    if (!cleanValue) {
        return { score: 0, reasons, category };
    }

    if (isPlaceholderValue(cleanValue)) {
        return { score: -20, reasons: ['похоже на заглушку или тестовое значение'], category: 'placeholder' };
    }

    const prefixRule = knownPrefixMatch(cleanValue);
    if (prefixRule) {
        score += 12;
        reasons.push(`известный префикс: ${prefixRule.label}`);
        category = 'known-prefix';
    }

    if (looksJwt(cleanValue)) {
        score += 10;
        reasons.push('похоже на JWT');
        category = 'jwt';
    }

    if (looksHex(cleanValue)) {
        score += 4;
        reasons.push('длинная hex-последовательность');
        category = category === 'generic' ? 'hex' : category;
    }

    if (looksBase64Url(cleanValue)) {
        score += 4;
        reasons.push('длинная base64url-последовательность');
        category = category === 'generic' ? 'encoded' : category;
    }

    const classes = classifyCharacterClasses(cleanValue);
    if (cleanValue.length >= 64) {
        score += 5;
        reasons.push('очень длинное значение');
    } else if (cleanValue.length >= 40) {
        score += 4;
        reasons.push('длинное значение');
    } else if (cleanValue.length >= 32) {
        score += 3;
        reasons.push('достаточно длинное значение');
    } else if (cleanValue.length >= 24) {
        score += 2;
        reasons.push('заметная длина значения');
    } else if (cleanValue.length >= 16) {
        score += 1;
    }

    if (classes >= 4) {
        score += 3;
        reasons.push('высокое разнообразие символов');
    } else if (classes === 3) {
        score += 2;
        reasons.push('смешанный набор символов');
    } else if (classes === 2) {
        score += 1;
    }

    if (hasSecretName(cleanName)) {
        score += 5;
        reasons.push('имя переменной похоже на секрет');
        category = category === 'generic' ? 'named-secret' : category;
    }

    if (/bearer/i.test(cleanName) || kind === 'auth-header') {
        score += 3;
        reasons.push('контекст авторизации');
    }

    if (/private[_-]?key/i.test(cleanName) || /private[_-]?key/i.test(cleanValue)) {
        score += 4;
        reasons.push('похоже на приватный ключ');
        category = 'private-key';
    }

    if (/session|cookie|csrf|xsrf/i.test(cleanName)) {
        score += 2;
        reasons.push('контекст сессионного секрета');
    }

    if (/^[a-z]+$/.test(cleanValue) && cleanValue.length < 24) {
        score -= 4;
    }

    if (/^[0-9]+$/.test(cleanValue) && cleanValue.length < 18) {
        score -= 5;
    }

    if (cleanValue.length < 12 && !prefixRule && !looksJwt(cleanValue) && !/key|token|secret|password|auth|bearer|cookie|session/i.test(cleanName)) {
        score -= 6;
    }

    if (cleanValue.length < 8) {
        score -= 10;
    }

    return { score, reasons, category };
}

function buildRedaction({ prefix, quote, value, kind, category }) {
    const cleanValue = stripQuotes(value);

    if (kind === 'private-key-block') {
        return '[REDACTED PRIVATE KEY BLOCK]';
    }

    if (kind === 'auth-header') {
        return `${prefix}[REDACTED_BEARER_TOKEN]`;
    }

    if (kind === 'url-param') {
        return `${prefix}[REDACTED_TOKEN]`;
    }

    const mask = cleanValue.length >= 8
        ? `${cleanValue.slice(0, 2)}…${cleanValue.slice(-2)}`
        : '***';

    if (prefix) {
        return `${prefix}${quote || '"'}${mask}${quote || '"'}`;
    }

    if (category === 'jwt') {
        return '[REDACTED_JWT]';
    }

    return '[REDACTED_SECRET]';
}

function buildPreview({ value, kind, category }) {
    const cleanValue = stripQuotes(value);

    if (kind === 'private-key-block') {
        return '-----BEGIN … PRIVATE KEY-----';
    }

    if (kind === 'auth-header') {
        return 'Authorization: Bearer ••••••••';
    }

    if (kind === 'url-param') {
        return '…token=[masked]';
    }

    if (cleanValue.length <= 10) {
        return cleanValue || '[masked]';
    }

    const left = cleanValue.slice(0, 4);
    const right = cleanValue.slice(-4);
    const marker = category === 'jwt' ? 'JWT' : 'masked';
    return `${left}…${right} (${marker})`;
}

function addDetection(detections, seen, fileIndex, filePath, matchIndex, fullMatch, data) {
    if (!fullMatch) return null;
    const key = `${fileIndex}:${matchIndex}:${fullMatch}`;
    if (seen.has(key)) return null;
    seen.add(key);

    const { name = '', value = '', prefix = '', quote = '', kind = 'generic' } = data;
    const scoreInfo = scoreCandidate({ name, value, kind });
    const exactConfidence = Math.max(0, Math.min(99, scoreInfo.score * 7));
    const keep = scoreInfo.score >= 8 || scoreInfo.category === 'known-prefix' || scoreInfo.category === 'jwt' || scoreInfo.category === 'private-key';

    if (!keep) return null;

    const detection = {
        id: '',
        fileIndex,
        filePath,
        matchIndex,
        fullMatch,
        prefix,
        quote,
        secretValue: stripQuotes(value),
        selected: true,
        kind,
        category: scoreInfo.category,
        confidence: exactConfidence,
        score: scoreInfo.score,
        reasons: scoreInfo.reasons,
        reasonText: scoreInfo.reasons.length ? scoreInfo.reasons.join('; ') : 'подозрительный токен',
        preview: buildPreview({ value, kind, category: scoreInfo.category }),
        redaction: buildRedaction({ prefix, quote, value, kind, category: scoreInfo.category })
    };

    detections.push(detection);
    return detection;
}

function scanContent(content, filePath, fileIndex, detections) {
    const seen = new Set();
    const spans = [];
    const overlapsExisting = (start, end) => spans.some(span => start < span.end && end > span.start);
    const text = String(content || '');

    const keyBlockRegex = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g;
    let match;
    while ((match = keyBlockRegex.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (overlapsExisting(start, end)) continue;
        const detection = addDetection(detections, seen, fileIndex, filePath, match.index, match[0], {
            kind: 'private-key-block',
            value: match[0],
            prefix: '',
            quote: ''
        });
        if (detection) spans.push({ start, end });
    }

    for (const pattern of LINE_PATTERNS) {
        pattern.regex.lastIndex = 0;
        while ((match = pattern.regex.exec(text)) !== null) {
            if (pattern.kind === 'auth-header') {
                const start = match.index;
                const end = start + match[0].length;
                if (overlapsExisting(start, end)) continue;
                const detection = addDetection(detections, seen, fileIndex, filePath, match.index, match[0], {
                    kind: 'auth-header',
                    name: 'authorization',
                    value: match[2],
                    prefix: match[1],
                    quote: ''
                });
                if (detection) spans.push({ start, end });
                continue;
            }

            if (pattern.kind === 'url-param') {
                const start = match.index;
                const end = start + match[0].length;
                if (overlapsExisting(start, end)) continue;
                const detection = addDetection(detections, seen, fileIndex, filePath, match.index, match[0], {
                    kind: 'url-param',
                    name: match[1],
                    value: match[2],
                    prefix: match[1],
                    quote: ''
                });
                if (detection) spans.push({ start, end });
                continue;
            }

            const prefix = match[1] || '';
            const quote = pattern.kind === 'bare' ? '' : (match[2] || '');
            const value = pattern.kind === 'bare' ? (match[2] || '') : (match[3] || '');
            const nameMatch = prefix.match(/(?:const|let|var)\s+([A-Za-z0-9_$.-]{1,80})/i)
                || prefix.match(/(?:['"])?([A-Za-z0-9_$.-]{1,80})(?:['"])?\s*[:=]/i)
                || prefix.match(/\b([A-Z0-9_]{2,})\s*=/i);
            const name = nameMatch ? nameMatch[1] : prefix;
            const start = match.index;
            const end = start + match[0].length;
            if (overlapsExisting(start, end)) continue;
            const detection = addDetection(detections, seen, fileIndex, filePath, match.index, match[0], {
                kind: pattern.kind,
                name,
                value,
                prefix,
                quote
            });
            if (detection) spans.push({ start, end });
        }
    }
}

export function scanForSecrets(fileContents) {
    const detections = [];

    fileContents.forEach((file, fileIndex) => {
        scanContent(file.content, file.path, fileIndex, detections);
    });

    detections.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        if (a.filePath !== b.filePath) return a.filePath.localeCompare(b.filePath);
        return a.matchIndex - b.matchIndex;
    });

    detections.forEach((item, index) => {
        item.id = `sec-${index}`;
        if (typeof item.selected !== 'boolean') {
            item.selected = true;
        }
    });

    return detections;
}

export function summarizeDetections(detections) {
    const total = detections.length;
    const high = detections.filter(item => item.confidence >= 80).length;
    const medium = detections.filter(item => item.confidence >= 55 && item.confidence < 80).length;
    const low = total - high - medium;

    return {
        total,
        high,
        medium,
        low,
        selected: detections.filter(item => item.selected !== false).length
    };
}
