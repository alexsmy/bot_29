export function buildFileTree(files) {
    const tree = {};
    files.forEach(file => {
        const parts = file.path.split('/');
        let current = tree;
        parts.forEach((part, i) => {
            if (i === parts.length - 1) current[part] = null;
            else {
                current[part] = current[part] || {};
                current = current[part];
            }
        });
    });
    return tree;
}

export function generateStructureString(tree, prefix = '') {
    let result = '';
    const keys = Object.keys(tree);
    keys.forEach((key, i) => {
        const isLast = i === keys.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        if (tree[key] !== null) {
            result += `${prefix}${connector}📁 ${key}\n`;
            result += generateStructureString(tree[key], newPrefix);
        } else {
            result += `${prefix}${connector}📄 ${key}\n`;
        }
    });
    return result;
}