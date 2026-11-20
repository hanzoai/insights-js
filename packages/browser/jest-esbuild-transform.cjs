const esbuild = require('esbuild')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

function hoistJestMocks(code) {
    const lines = code.split('\n')
    const mockBlocks = []
    const rest = []
    let i = 0

    while (i < lines.length) {
        const line = lines[i]
        if (/^jest\.(mock|unmock|doMock|enableAutomock|disableAutomock)\(/.test(line)) {
            const block = [line]
            let depth = (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length
            i += 1
            while (i < lines.length && depth > 0) {
                const nextLine = lines[i]
                block.push(nextLine)
                depth += (nextLine.match(/\(/g) || []).length - (nextLine.match(/\)/g) || []).length
                i += 1
            }
            mockBlocks.push(block.join('\n'))
        } else {
            rest.push(line)
            i += 1
        }
    }

    if (mockBlocks.length === 0) return code
    return `${mockBlocks.join('\n')}\n${rest.join('\n')}`
}

module.exports = {
    process(sourceText, sourcePath) {
        const ext = path.extname(sourcePath).toLowerCase()
        const loader = ext === '.tsx' ? 'tsx' : ext === '.jsx' ? 'jsx' : ext === '.ts' ? 'ts' : 'js'
        const result = esbuild.transformSync(sourceText, {
            loader,
            format: 'cjs',
            target: 'node20',
            jsx: 'automatic',
            jsxImportSource: 'preact',
            sourcemap: 'inline',
            sourcefile: sourcePath,
            define: {
                'import.meta.url': JSON.stringify(pathToFileURL(sourcePath).href),
            },
        })
        const code =
            sourcePath.includes('.test.') || sourcePath.includes('.spec.')
                ? hoistJestMocks(result.code)
                : result.code
        return { code }
    },
}
