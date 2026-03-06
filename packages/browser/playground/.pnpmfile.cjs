const repoRoot = __dirname + '/../../..'
/** @type {import('pnpm').Hooks} */
module.exports = {
    hooks: {
        readPackage(pkg) {
            function rewriteLocalDeps(deps) {
                if (deps) {
                    for (const dep in deps) {
                        if (dep.startsWith('insights') || dep.startsWith('@insights')) {
                            const tarballName = dep.replace('@', '').replace('/', '-')
                            deps[dep] = `file:${repoRoot}/target/${tarballName}.tgz`
                        }
                    }
                }
            }

            rewriteLocalDeps(pkg.dependencies)
            rewriteLocalDeps(pkg.devDependencies)
            rewriteLocalDeps(pkg.optionalDependencies)

            return pkg
        },
    },
}
