

export function removeHashComments(code, onCommentRemoved) {
    let out = '';
    let i = 0;
    let inString = false;
    let stringChar = '';
    let inLineComment = false;

    while (i < code.length) {
        const char = code[i];
        const nextChar = code[i + 1] || '';

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

        if (char === '"' || char === "'" || char === '`') {
            inString = true;
            stringChar = char;
            out += char;
            i++;
            continue;
        }

        if (char === '#') {
            inLineComment = true;
            i++;
            continue;
        }

        out += char;
        i++;
    }

    if (inLineComment) {
        onCommentRemoved();
    }

    return out;
}

    