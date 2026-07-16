import { insightsMiddleware } from '@hanzo/insights-next'

export default insightsMiddleware({ proxy: true })

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
