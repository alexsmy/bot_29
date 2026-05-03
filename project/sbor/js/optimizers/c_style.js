

function isRegexStart(out) {
    const trimmed = out.trimEnd();
    if (trimmed.length === 0) return true;

    const regexPreceders = /[-=+\|!*&^~%/(,;:{}\[\]<>?]\s*$/;
    if (regexPreceders.test(trimmed)) return true;
    if (trimmed.endsWith('return') || trimmed.endsWith('typeof') || trimmed.endsWith('yield') || trimmed.endsWith('await')) return true;
    return false;
}

export function removeCStyleComments(code, onCommentRemoved) {
    let out = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    let inBlockComment = false;
    let inLineComment = false;
    let inRegex = false;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';

        if (inBlockComment) {
            if (char === '*' && nextChar === '/') {
                inBlockComment = false;
                i += 2;
                onCommentRemoved();
                continue;
            }
            i++;
            continue;
        }

        if (inLineComment) {
            if (char === '\n' || char === '\r') {
                inLineComment = false;
                out += char;
            }
            i++;
            continue;
        }

        if (inString) {
            out += char;
            if (char === '\\') {
                out += nextChar;
                i += 2;
                continue;
            }
            if (char === stringChar) {
                inString = false;
            }
            i++;
            continue;
        }

        if (inRegex) {
            out += char;
            if (char === '\\') {
                out += nextChar;
                i += 2;
                continue;
            }
            if (char === '/') {
                inRegex = false;
            }
            i++;
            continue;
        }

        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
            out += char;
            i++;
            continue;
        }

        if (char === '/') {
            if (nextChar === '*') {
                inBlockComment = true;
                i += 2;
                continue;
            }
            if (nextChar === '/') {
                inLineComment = true;
                i += 2;
                continue;
            }
            if (isRegexStart(out)) {
                inRegex = true;
                out += char;
                i++;
                continue;
            }
        }

        out += char;
        i++;
    }

    if (inLineComment || inBlockComment) {
        onCommentRemoved();
    }

    return out;
}

    