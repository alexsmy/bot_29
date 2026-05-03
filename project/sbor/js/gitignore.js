

export function parseGitignore(content) {
    const rules =[];
    const lines = content.split('\n');

    for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;

        let isNegative = false;
        if (line.startsWith('!')) {
            isNegative = true;
            line = line.substring(1);
        }

        let regexStr = line.replace(/[.+^${}()|[\]\\]/g, '\\$&');

        regexStr = regexStr.replace(/\?/g, '[^/]');
        regexStr = regexStr.replace(/\*\*/g, '.*');
        regexStr = regexStr.replace(/\*/g, '[^/]*');

        if (regexStr.startsWith('/')) {
            regexStr = '^' + regexStr.substring(1);
        } else {
            regexStr = '(^|/)' + regexStr;
        }

        if (regexStr.endsWith('/')) {
            regexStr = regexStr + '.*';
        } else {
            regexStr = regexStr + '($|/)';
        }

        rules.push({
            regex: new RegExp(regexStr),
            isNegative: isNegative,
            original: line
        });
    }
    return rules;
}

export function isIgnoredByGit(filePath, rules) {
    const parts = filePath.split('/');
    parts.shift();
    const relativePath = parts.join('/');

    let ignored = false;
    for (const rule of rules) {
        if (rule.regex.test(relativePath)) {
            ignored = !rule.isNegative;
        }
    }
    return ignored;
}

    