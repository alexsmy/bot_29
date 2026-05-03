

export function generateRepoMap(processedFiles) {
    let mapText = "";
    let hasMap = false;

    processedFiles.forEach(file => {
        const ext = file.lang;
        const content = file.content;
        let symbols = [];


        if (['js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs'].includes(ext)) {

            const funcClassRegex = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|class)\s+([a-zA-Z0-9_]+)/gm;
            let match;
            while ((match = funcClassRegex.exec(content)) !== null) {
                symbols.push(match[0].trim());
            }


            const arrowRegex = /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=]+)\s*=>/gm;
            while ((match = arrowRegex.exec(content)) !== null) {

                symbols.push(match[0].split('=')[0].trim() + ' => {...}');
            }
        }

        else if (['py'].includes(ext)) {
            const pyRegex = /^\s*(?:async\s+)?(?:def|class)\s+([a-zA-Z0-9_]+)/gm;
            let match;
            while ((match = pyRegex.exec(content)) !== null) {
                symbols.push(match[0].trim());
            }
        }

        else if (['php'].includes(ext)) {
            const phpRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:function|class|interface|trait)\s+([a-zA-Z0-9_]+)/gm;
            let match;
            while ((match = phpRegex.exec(content)) !== null) {
                symbols.push(match[0].trim());
            }
        }

        else if (['java', 'cs'].includes(ext)) {
            const javaRegex = /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum|record)\s+([a-zA-Z0-9_]+)/gm;
            let match;
            while ((match = javaRegex.exec(content)) !== null) {
                symbols.push(match[0].trim());
            }
        }


        if (symbols.length > 0) {
            hasMap = true;
            mapText += `### ${file.path}\n`;

            symbols.forEach(sym => {
                const cleanSym = sym.length > 100 ? sym.substring(0, 100) + '...' : sym;
                mapText += `- \`${cleanSym}\`\n`;
            });
            mapText += '\n';
        }
    });

    return hasMap ? mapText.trim() : null;
}

    