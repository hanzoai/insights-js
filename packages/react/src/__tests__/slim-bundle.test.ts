import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Guard against the slim bundle accidentally pulling in a runtime insights-js
 * dependency. The slim entrypoint's whole purpose is to avoid shipping the
 * insights-js runtime so consumers can bring their own client instance.
 *
 * Today this works because every shared module (hooks, components, helpers)
 * only reaches InsightsContext.ts — never the full InsightsProvider.tsx — and
 * InsightsProvider.tsx's insights-js import is type-only. But if someone
 * accidentally adds a runtime import, Rollup's `external` config means
 * `insights-js` would appear as a bare import/require in the output instead of
 * being bundled, making it easy to grep for.
 */
describe('slim bundle', () => {
    const distRoot = resolve(__dirname, '../../dist')

    it('ESM slim bundle has no runtime insights-js imports', () => {
        const content = readFileSync(resolve(distRoot, 'esm/slim/index.js'), 'utf-8')
        const matches = content.match(/['"]insights-js['"]/g)
        expect(matches).toBeNull()
    })

    it('UMD slim bundle has no runtime insights-js imports', () => {
        const content = readFileSync(resolve(distRoot, 'umd/slim/index.js'), 'utf-8')
        const matches = content.match(/['"]insights-js['"]/g)
        expect(matches).toBeNull()
    })
})
