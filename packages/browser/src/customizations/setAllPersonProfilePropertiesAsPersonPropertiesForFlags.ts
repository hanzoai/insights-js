import { Insights } from '../insights-core'
import {
    CAMPAIGN_PARAMS,
    getCampaignParams,
    EVENT_TO_PERSON_PROPERTIES,
    getEventProperties,
    getReferrerInfo,
} from '../utils/event-utils'
import { each, extend } from '../utils'
import { includes } from '@hanzo/insights-core'

export const setAllPersonProfilePropertiesAsPersonPropertiesForFlags = (insights: Insights): void => {
    const allProperties = extend(
        {},
        getEventProperties(
            insights.config.mask_personal_data_properties,
            insights.config.custom_personal_data_properties
        ),
        getCampaignParams(
            insights.config.custom_campaign_params,
            insights.config.mask_personal_data_properties,
            insights.config.custom_personal_data_properties
        ),
        getReferrerInfo()
    )
    const personProperties: Record<string, string> = {}
    each(allProperties, function (v, k: string) {
        if (includes(CAMPAIGN_PARAMS, k) || includes(EVENT_TO_PERSON_PROPERTIES, k)) {
            personProperties[k] = v
        }
    })

    insights.setPersonPropertiesForFlags(personProperties)
}
