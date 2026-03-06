import { window } from '../../../utils/globals'

import { SurveyAppearance } from '../../../insights-surveys-types'

import { useContext } from 'preact/hooks'
import { SurveyContext } from '../surveys-extension-utils'
import { InsightsLogo } from './InsightsLogo'

export function BottomSection({
    text,
    submitDisabled,
    appearance,
    onSubmit,
    link,
    onPreviewSubmit,
    skipSubmitButton,
}: {
    text: string
    submitDisabled: boolean
    appearance: SurveyAppearance
    onSubmit: () => void
    link?: string | null
    onPreviewSubmit?: () => void
    skipSubmitButton?: boolean
}) {
    const { isPreviewMode } = useContext(SurveyContext)
    return (
        <div className="bottom-section">
            {!skipSubmitButton && (
                <button
                    className="form-submit"
                    disabled={submitDisabled}
                    aria-label="Submit survey"
                    type="button"
                    onClick={() => {
                        if (link) {
                            window?.open(link)
                        }
                        if (isPreviewMode) {
                            onPreviewSubmit?.()
                        } else {
                            onSubmit()
                        }
                    }}
                >
                    {text}
                </button>
            )}
            {!appearance.whiteLabel && <InsightsLogo urlParams={{ utm_source: 'survey-footer' }} />}
        </div>
    )
}
