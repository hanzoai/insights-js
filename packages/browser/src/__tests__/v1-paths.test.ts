import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

// Every first-party route is /v1/…; the server answers /api/… with 404.
const roots = [join(__dirname, '..'), join(__dirname, '../../../core/src')]

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
            return name === '__tests__' ? [] : sources(path)
        }
        return /\.(ts|tsx|js)$/.test(name) ? [path] : []
    })
}

describe('first-party paths', () => {
    it.each(roots)('%s calls no /api/ route', (root) => {
        const offenders = sources(root).filter((path) => /['"`]\/api\//.test(readFileSync(path, 'utf8')))
        expect(offenders).toEqual([])
    })
})
