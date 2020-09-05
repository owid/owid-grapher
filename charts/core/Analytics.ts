const DEBUG = false

// Docs on GA's event interface: https://developers.google.com/analytics/devguides/collection/analyticsjs/events
interface GAEvent {
    hitType: string
    eventCategory: string
    eventAction: string
    eventLabel?: string
    eventValue?: number
}

export class Analytics {
    constructor(environment: string) {
        this.isDev = environment === "development"
    }

    private isDev: boolean

    logChartError(error: any, info: any) {
        this.logToAmplitude("CHART_ERROR", { error, info })
        this.logToGA("Errors", "Chart")
    }

    logExploreError(error: any, info: any) {
        this.logToAmplitude("EXPLORE_ERROR", { error, info })
        this.logToGA("Errors", "Explore")
    }

    logEntitiesNotFoundError(entities: string[]) {
        this.logToAmplitude("ENTITIES_NOT_FOUND", { entities })
        this.logToGA("Errors", "ENTITIES_NOT_FOUND", JSON.stringify(entities))
    }

    logChartTimelinePlay(slug?: string) {
        this.logToAmplitude("CHART_TIMELINE_PLAY")
        this.logToGA("Chart", "TimelinePlay", slug)
    }

    logPageNotFound(url: string) {
        this.logToAmplitude("NOT_FOUND", { href: url })
        this.logToGA("Errors", "NotFound", url)
    }

    logChartsPageSearchQuery(query: string) {
        this.logToAmplitude("Charts Page Filter", { query })
        this.logToGA("ChartsPage", "Filter", query)
    }

    logGlobalEntityControl(action: "open" | "change" | "close", note?: string) {
        this.logToAmplitude("GLOBAL_ENTITY_CONTROL", { action, note })
        this.logToGA("GlobalEntityControl", action, note)
    }

    logCountrySelectorEvent(
        countryPickerName: string,
        action: "enter" | "select" | "deselect" | "sortBy" | "sortOrder",
        note?: string
    ) {
        this.logToAmplitude(
            `${countryPickerName.toUpperCase()}_DATA_EXPLORER_COUNTRY_SELECTOR`,
            {
                action,
                note
            }
        )
        this.logToGA(
            `${countryPickerName}DataExplorerCountrySelector`,
            action,
            note
        )
    }

    logCovidCountryProfileSearch(country: string) {
        const key = "COVID_COUNTRY_PROFILE_SEARCH"
        this.logToAmplitude(key, { country })
        this.logToGA(key, country)
    }

    logSiteClick(text: string, href?: string, note?: string) {
        this.logToAmplitude("OWID_SITE_CLICK", {
            text,
            href,
            note
        })
        this.logToGA("SiteClick", note || "unknown-category", text)
    }

    logKeyboardShortcut(shortcut: string, combo: string) {
        this.logToGA("KeyboardShortcut", shortcut, combo)
    }

    logPageLoad() {
        this.logToAmplitude("OWID_PAGE_LOAD")
    }

    private logToAmplitude(name: string, props?: any) {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log("Analytics.logToAmplitude", name, props)
        }
        if (!window.amplitude) return

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
        window.amplitude.getInstance().logEvent(name, props)
    }

    private logToGA(
        eventCategory: string,
        eventAction: string,
        eventLabel?: string,
        eventValue?: number
    ) {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log(
                "Analytics.logToGA",
                eventCategory,
                eventAction,
                eventLabel,
                eventValue
            )
        }
        const event: GAEvent = {
            hitType: "event",
            eventCategory,
            eventAction,
            eventLabel,
            eventValue
        }
        if (window.ga) {
            // https://developers.google.com/analytics/devguides/collection/analyticsjs/ga-object-methods-reference
            window.ga(function () {
                const tracker = window.ga.getAll()[0]
                // @types/google.analytics seems to suggest this usage is invalid but we know Google
                // Analytics logs these events correctly.
                // I have avoided changing the implementation for now, but we should look into this as
                // we use Google Analytics more.
                // -@danielgavrilov 2020-04-23
                if (tracker) tracker.send(event as any)
            })
        }
    }
}
