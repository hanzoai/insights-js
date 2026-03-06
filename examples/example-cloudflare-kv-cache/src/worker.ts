import { Insights } from 'insights-node'
import { CloudflareKVFlagCacheReader, CloudflareKVFlagCacheWriter } from './cache'

export interface Env {
    INSIGHTS_CACHE: KVNamespace
    INSIGHTS_PROJECT_API_KEY: string
    INSIGHTS_HOST: string
    INSIGHTS_PERSONAL_API_KEY: string
}

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        // This cache is initialized as **read-only**. It won't attempt to
        // refresh flag definitions itself. We leave that to the scheduled handler.
        const cache = new CloudflareKVFlagCacheReader(env.INSIGHTS_CACHE, env.INSIGHTS_PROJECT_API_KEY)
        const insights = new Insights(env.INSIGHTS_PROJECT_API_KEY, {
            host: env.INSIGHTS_HOST,
            personalApiKey: env.INSIGHTS_PERSONAL_API_KEY,
            enableLocalEvaluation: true,
            flagDefinitionCacheProvider: cache,
        })
        const exampleDistinctId = Math.random().toString(36).substring(2, 15)
        const enabled = await insights.isFeatureEnabled('beta-feature', exampleDistinctId, {
            onlyEvaluateLocally: true,
        })

        return new Response(
            JSON.stringify({
                userId: exampleDistinctId,
                feature: 'beta-feature',
                enabled,
                error: enabled === undefined ? 'Flag definition not found' : undefined,
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                },
            }
        )
    },

    // Scheduled handler to refresh flag definitions via cron job.
    // See wrangler.toml triggers for schedule.
    async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
        const cache = new CloudflareKVFlagCacheWriter(env.INSIGHTS_CACHE, env.INSIGHTS_PROJECT_API_KEY)
        const insights = new Insights(env.INSIGHTS_PROJECT_API_KEY, {
            host: env.INSIGHTS_HOST,
            personalApiKey: env.INSIGHTS_PERSONAL_API_KEY,
            enableLocalEvaluation: true,
            featureFlagsPollingInterval: undefined, // Disable polling in scheduled job
            flagDefinitionCacheProvider: cache,
        })

        ctx.waitUntil(
            (async () => {
                // `waitForLocalEvaluationReady` will resolve only after fresh flag definitions
                // have been fetched and cached.
                await insights.waitForLocalEvaluationReady()
                await insights.shutdown()
            })()
        )
    },
}
