import type { Metadata } from 'next'
import { InsightsProvider, InsightsPageView } from '@hanzo/insights-next'
import { Nav } from './components/Nav'
import { ConsentBanner } from './components/ConsentBanner'
import './globals.css'

export const metadata: Metadata = {
    title: '@hanzo/insights-next App Router Example',
    description: 'Example Next.js App Router project demonstrating @hanzo/insights-next features',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body className="bg-gray-50 text-gray-900 min-h-screen">
                <InsightsProvider
                    apiKey={process.env.NEXT_PUBLIC_INSIGHTS_KEY!}
                    clientOptions={{ api_host: '/ingest' }}
                    bootstrapFlags
                >
                    <InsightsPageView />
                    <Nav />
                    <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
                    <ConsentBanner />
                </InsightsProvider>
            </body>
        </html>
    )
}
