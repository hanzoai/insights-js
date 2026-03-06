import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './app.tsx'
import { insights } from '@hanzo/insights'

insights.init(import.meta.env.VITE_INSIGHTS_KEY || '', {
    api_host: import.meta.env.VITE_INSIGHTS_HOST || 'http://localhost:8010',
    autocapture: true,
    defaults: '2025-11-30',
})

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>
)
