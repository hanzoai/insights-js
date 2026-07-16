import { createLogger, Logger, InsightsPersistedProperty, Survey } from '@hanzo/insights-core'
import { applySurveyTranslation, detectSurveyLanguage } from '@hanzo/insights-core/surveys'
import { Insights } from '../insights-rn'

const logger = createLogger('[SurveyTranslations]')

function getLogger(instance: Insights): Logger | undefined {
  return instance.isDebug ? logger : undefined
}

export function detectUserLanguage(instance: Insights): string | null {
  return detectSurveyLanguage(
    {
      overrideLanguage: instance.getSurveyDisplayLanguageOverride(),
      storedPersonProperties: instance.getPersistedProperty(InsightsPersistedProperty.PersonProperties),
      locale: instance.getCommonEventProperties().$locale,
    },
    getLogger(instance)
  )
}

export function applySurveyTranslationForUser(
  survey: Survey,
  instance: Insights
): { survey: Survey; language: string | null } {
  const userLanguage = detectUserLanguage(instance)
  const logger = getLogger(instance)

  if (!userLanguage) {
    logger?.info('No user language detected')
    return { survey, language: null }
  }

  const result = applySurveyTranslation(survey, userLanguage, logger)

  return {
    survey: result.survey,
    language: result.matchedKey,
  }
}
