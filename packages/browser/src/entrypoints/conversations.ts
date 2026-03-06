import { initConversations } from '../extensions/conversations/external'
import { assignableWindow } from '../utils/globals'

assignableWindow.__InsightsExtensions__ = assignableWindow.__InsightsExtensions__ || {}
assignableWindow.__InsightsExtensions__.initConversations = initConversations

export default initConversations
