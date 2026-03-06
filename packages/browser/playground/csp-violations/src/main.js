if (!window.__insightsObservedViolations) {
    window.__insightsObservedViolations = []
}

if (window.ReportingObserver) {
    const observer = new window.ReportingObserver(
        (reports) => {
            reports.forEach((violation) => {
                console.log(violation)
                window.__insightsObservedViolations.push(violation)
            })
        },
        {
            types: ['csp-violation'],
        }
    )
    observer.observe()
}
