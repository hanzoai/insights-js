import { Insights } from '@hanzo/insights-node'
import { uuidv7 } from '@hanzo/insights-core/vendor/uuidv7'
import { defineNitroPlugin } from 'nitropack/runtime'
import { useRuntimeConfig } from '#imports'
import type { InsightsCommon, InsightsServerConfig } from '../module'
import type { JsonType } from '@hanzo/insights-core'

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig()
  const insightsCommon = runtimeConfig.public.insights as InsightsCommon
  const insightsServerConfig = runtimeConfig.insightsServerConfig as InsightsServerConfig
  const debug = insightsCommon.debug as boolean

  const client = new Insights(insightsCommon.publicKey, {
    host: insightsCommon.host,
    ...insightsServerConfig,
  })

  if (debug) {
    client.debug(true)
  }

  if (insightsServerConfig.enableExceptionAutocapture) {
    nitroApp.hooks.hook('error', (error, { event }) => {
      const props: JsonType = {
        $process_person_profile: false,
      }
      if (event?.path) {
        props.path = event.path
      }
      if (event?.method) {
        props.method = event.method
      }

      client.captureException(error, uuidv7(), props)
    })
  }

  nitroApp.hooks.hook('close', async () => {
    await client.shutdown()
  })
})
