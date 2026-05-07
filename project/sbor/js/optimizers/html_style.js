

export function removeHtmlComments(code, onCommentRemoved) {
    let out = '';
    let i = 0;
    let inComment = false;
    let inString = false;
    let stringChar = '';

    while (i < code.length) {
        const char = code[i];

        if (inComment) {
            if (char === '-' && code[i+1] === '-' && code[i+2] === '>') {
                inComment = false;
                i += 3;
                onCommentRemoved();
                continue;
            }
            i++;
            continue;
        }

        if (inString) {
            out += char;
            if (char === stringChar) {
                inString = false;
            }
            i++;
            continue;
        }

        if (char === '"' || char === "'") {
            inString = true;
            stringChar = char;
            out += char;
            i++;
            continue;
        }

        if (char === '<' && code[i+1] === '!' && code[i+2] === '-' && code[i+3] === '-') {
            inComment = true;
            i += 4;
            continue;
        }

        out += char;
        i++;
    }

    if (inComment) {
        onCommentRemoved();
    }

    return out;
}

    