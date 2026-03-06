'use client'

import Link from 'next/link'
import insights from '@hanzo/insights'

export default function Home() {
    return (
        <div>
            <main style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <Link href="./error?messsage=Rendering%20Error">
                    <button>Generate rendering error</button>
                </Link>
                <button onClick={() => insights.captureException(new Error('Programming error'))}>Send error</button>
            </main>
        </div>
    )
}
