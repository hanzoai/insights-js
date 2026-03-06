import { resetContext, getContext } from 'kea'
import { insightsKeaLogger } from '@hanzo/insights/lib/src/customizations'

// Initialize Kea with Insights logging plugin
resetContext({
    plugins: [
        insightsKeaLogger({
            // Example: mask sensitive data
            // maskState: (state) => {
            //     // Remove sensitive fields from state logging
            //     const { user, ...maskedState } = state
            //     return { ...maskedState, user: { ...user, email: '[MASKED]' } }
            // },
            // Example: skip logging certain actions
            // maskAction: (action) => {
            //     if (action.type.includes('SENSITIVE')) return null
            //     return action
            // },
        }),
    ],
})

export default getContext()
