import { record as rrwebRecord, wasMaxDepthReached, resetMaxDepthState } from '@hanzo/rrweb-record'
import { getRecordConsolePlugin } from '@hanzo/rrweb-plugin-console-record'
import { assignableWindow } from '../utils/globals'
import { getRecordNetworkPlugin } from '../extensions/replay/external/network-plugin'
import { LazyLoadedSessionRecording } from '../extensions/replay/external/lazy-loaded-session-recorder'

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.rrwebPlugins = { getRecordConsolePlugin, getRecordNetworkPlugin }
assignableWindow.__InsightsExtensions__.rrweb = {
    record: rrwebRecord,
    version: 'v2',
    wasMaxDepthReached,
    resetMaxDepthState,
}
assignableWindow.__InsightsExtensions__.initSessionRecording = (ph) => new LazyLoadedSessionRecording(ph)

export default rrwebRecord
