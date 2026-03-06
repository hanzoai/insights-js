import { InsightsPersistedProperty } from '@hanzo/insights-core'
import { useCallback, useEffect, useState } from 'react'
import { useInsights } from '../hooks/useInsights'

type SurveyStorage = {
  seenSurveys: string[]
  setSeenSurvey: (surveyId: string) => void
  lastSeenSurveyDate: Date | undefined
  setLastSeenSurveyDate: (date: Date) => void
}

export function useSurveyStorage(): SurveyStorage {
  const insightsStorage = useInsights()
  const [lastSeenSurveyDate, setLastSeenSurveyDate] = useState<Date | undefined>(undefined)
  const [seenSurveys, setSeenSurveys] = useState<string[]>([])

  useEffect(() => {
    insightsStorage.ready().then(() => {
      const lastSeenSurveyDate = insightsStorage.getPersistedProperty(InsightsPersistedProperty.SurveyLastSeenDate)
      if (typeof lastSeenSurveyDate === 'string') {
        setLastSeenSurveyDate(new Date(lastSeenSurveyDate))
      }

      const serialisedSeenSurveys = insightsStorage.getPersistedProperty(InsightsPersistedProperty.SurveysSeen)
      if (typeof serialisedSeenSurveys === 'string') {
        const parsedSeenSurveys: unknown = JSON.parse(serialisedSeenSurveys)
        if (Array.isArray(parsedSeenSurveys) && typeof parsedSeenSurveys[0] === 'string') {
          setSeenSurveys(parsedSeenSurveys)
        }
      }
    })
  }, [insightsStorage])

  return {
    seenSurveys,
    setSeenSurvey: useCallback(
      (surveyId: string) => {
        setSeenSurveys((current) => {
          // To keep storage bounded, only keep the last 20 seen surveys
          const newValue = [surveyId, ...current.filter((id) => id !== surveyId)]
          insightsStorage.setPersistedProperty(
            InsightsPersistedProperty.SurveysSeen,
            JSON.stringify(newValue.slice(0, 20))
          )
          return newValue
        })
      },
      [insightsStorage]
    ),
    lastSeenSurveyDate,
    setLastSeenSurveyDate: useCallback(
      (date: Date) => {
        setLastSeenSurveyDate(date)
        insightsStorage.setPersistedProperty(InsightsPersistedProperty.SurveyLastSeenDate, date.toISOString())
      },
      [insightsStorage]
    ),
  }
}
