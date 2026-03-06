import { createApp } from 'vue'
import App from './App.vue'
import { insights } from '@hanzo/insights'

insights.init(import.meta.env.VITE_INSIGHTS_KEY, {
    api_host: import.meta.env.VITE_INSIGHTS_HOST || 'http://localhost:8010/',
    defaults: '2025-11-30',
})

createApp(App).mount('#app')
