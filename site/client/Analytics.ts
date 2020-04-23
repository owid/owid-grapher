// Docs on GA's event interface: https://developers.google.com/analytics/devguides/collection/analyticsjs/events
interface GAEvent {
    hitType: string
    eventCategory: string
    eventAction: string
    eventLabel?: string
    eventValue?: number
}

export class Analytics {
    static logChartError(error: any, info: any) {
        this.logToAmplitude("CHART_ERROR", { error, info })
        this.logToGA("Errors", "Chart")
    }

    static logExploreError(error: any, info: any) {
        this.logToAmplitude("EXPLORE_ERROR", { error, info })
        this.logToGA("Errors", "Explore")
    }

    static logChartTimelinePlay(slug?: string) {
        this.logToAmplitude("CHART_TIMELINE_PLAY")
        this.logToGA("Chart", "TimelinePlay", slug)
    }

    static logPageNotFound(url: string) {
        this.logToAmplitude("NOT_FOUND", { href: url })
        this.logToGA("Errors", "NotFound", url)
    }

    static logChartsPageSearchQuery(query: string) {
        this.logToAmplitude("Charts Page Filter", { query })
        this.logToGA("ChartsPage", "Filter", query)
    }

    static logSiteClick(text: string, href?: string, note?: string) {
        this.logToAmplitude("OWID_SITE_CLICK", {
            text,
            href,
            note
        })
        this.logToGA("SiteClick", note || "unknown-category", text)
    }

    static logPageLoad() {
        this.logToAmplitude("OWID_PAGE_LOAD")
    }

    private static logToAmplitude(name: string, props?: any) {
        props = Object.assign(
            {},
            {
                context: {
                    pageHref: window.location.href,
                    pagePath: window.location.pathname,
                    pageTitle: document.title.replace(/ - [^-]+/, "")
                }
            },
            props
        )
        if (window.amplitude)
            window.amplitude.getInstance().logEvent(name, props)
    }

    private static logToGA(
        eventCategory: string,
        eventAction: string,
        eventLabel?: string,
        eventValue?: number
    ) {
        const event: GAEvent = {
            hitType: "event",
            eventCategory,
            eventAction,
            eventLabel,
            eventValue
        }
        if (window.ga) {
            const tracker = window.ga.getAll()[0]
            // @types/google.analytics seems to suggest this usage is invalid but we know Google
            // Analytics logs these events correctly.
            // I have avoided changing the implementation for now, but we should look into this as
            // we use Google Analytics more.
            // -@danielgavrilov 2020-04-23
            if (tracker) tracker.send(event as any)
        }
    }
}
