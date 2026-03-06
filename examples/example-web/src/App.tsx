import { useEffect, useState } from 'react'
import './App.css'
import { insights } from './insights'

const GLOBAL_EVENTS: { event: string; payload: any }[] = []
export const useInsightsDebugEvents = () => {
  const [localEvents, setLocalEvents] = useState(GLOBAL_EVENTS)

  useEffect(() => {
    const onEvent = (event: string, payload: any) => {
      // console.log('On event', event, payload)
      GLOBAL_EVENTS.push({
        event,
        payload,
      })
      setLocalEvents([...GLOBAL_EVENTS])
    }

    const listeners = [
      insights.on('capture', (e) => onEvent('capture', e)),
      insights.on('identify', (e) => onEvent('identify', e)),
      insights.on('screen', (e) => onEvent('screen', e)),
      insights.on('autocapture', (e) => onEvent('autocapture', e)),
      insights.on('featureflags', (e) => onEvent('featureflags', e)),
      insights.on('flush', (e) => onEvent('flush', e)),
    ]

    return () => {
      listeners.forEach((x) => x())
    }
  }, [])

  return localEvents
}

const DebugEvents = (): JSX.Element => {
  const events = useInsightsDebugEvents()

  return (
    <div className="Debugger">
      <h2>Events Log</h2>
      {events.map((item) => (
        <div>
          <>
            <span>{item.event}</span>
            <span>{JSON.stringify(item.payload || '').substring(0, 100) + '...'}</span>
          </>
        </div>
      ))}
    </div>
  )
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <p>This is an example app for testing the @hanzo/insights-lite lib</p>
        <button className="Button" onClick={() => insights.capture('random event', { random: Math.random() })}>
          Track Event
        </button>
        <button className="Button" onClick={() => insights.identify('user-123')}>
          Identify
        </button>
      </header>

      <DebugEvents />
    </div>
  )
}

export default App
