'use client'
import { useInsights } from '@hanzo/insights/react'
import { captureServerError } from './actions'

function randomID() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export default function Home() {
    const insights = useInsights()
    return (
        <div>
            <main>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '30px',
                    }}
                >
                    <button onClick={() => insights.captureException(new Error('exception captured'))}>
                        Capture error manually
                    </button>
                    <button
                        onClick={() => {
                            addCheckoutExceptionSteps()
                            throw new Error('Payment form crashed before submit')
                        }}
                    >
                        Capture error automatically
                    </button>
                    <button
                        onClick={() => {
                            addCheckoutExceptionSteps()
                            Promise.reject(new Error('Payment provider timed out'))
                        }}
                    >
                        Capture promise rejection automatically
                    </button>
                    <button onClick={() => insights.capture('$exception')}>Capture exception via capture()</button>
                    <button onClick={() => captureServerError()}>Create server exception!</button>
                    <button
                        onClick={() =>
                            insights.captureException(new Error('custom fingerprint'), {
                                $exception_fingerprint: randomID(),
                            })
                        }}
                    >
                        Create custom fingerprint!
                    </button>
                    <button onClick={() => console.error('This is an error message')}>Error log something</button>
                </div>
            </main>
        </div>
    )
}
