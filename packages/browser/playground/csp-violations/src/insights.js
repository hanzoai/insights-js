// src/insights.js
import insights from '@hanzo/insights'

insights.init(process.env.INSIGHTS_PROJECT_API_KEY, {
    api_host: process.env.INSIGHTS_API_HOST,
    ui_host: process.env.INSIGHTS_UI_HOST,
    person_profiles: 'identified_only',
})

window.hi = insights
