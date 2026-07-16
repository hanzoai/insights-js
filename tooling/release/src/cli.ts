type Command = 'upload-s3'

function getUsage(): string {
    return ['Usage:', '  node tooling/release/src/cli.ts upload-s3 <bucket> <version>'].join('\n')
}

async function main(): Promise<void> {
    const [command, ...args] = process.argv.slice(2) as [Command | undefined, ...string[]]

    switch (command) {
        case 'upload-s3': {
            const [bucket, version] = args
            if (!bucket || !version) {
                throw new Error(`upload-s3 requires <bucket> <version>\n\n${getUsage()}`)
            }
            const { uploadInsightsJsS3 } = await import('./upload-insights-js-s3.ts')
            await uploadInsightsJsS3(bucket, version)
            return
        }
        default:
            throw new Error(getUsage())
    }
}

void main().catch((error) => {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
})
