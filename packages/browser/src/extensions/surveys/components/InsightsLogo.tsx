import { IconInsightsLogo } from '../icons'

interface InsightsLogoProps {
    urlParams?: Record<string, string>
}

export function InsightsLogo({ urlParams }: InsightsLogoProps) {
    // Manual query string building for IE11/op_mini compatibility (no URLSearchParams)
    const queryString = urlParams
        ? Object.entries(urlParams)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
              .join('&')
        : ''

    return (
        <a
            href={`https://insights.com/surveys${queryString ? `?${queryString}` : ''}`}
            target="_blank"
            rel="noopener"
            className="footer-branding"
        >
            Survey by {IconInsightsLogo}
        </a>
    )
}
