import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"

export class SiteAnalytics extends GrapherAnalytics {
    logCountryProfileSearch(country: string) {
        this.logToGA({
            event: EventCategory.CountryProfileSearch,
            eventContext: country,
        })
    }

    logPageNotFoundError(url: string) {
        this.logToGA({
            event: EventCategory.SiteError,
            eventAction: "not_found",
            eventContext: url,
        })
    }

    logChartsPageSearchQuery(query: string) {
        this.logToGA({
            event: EventCategory.Filter,
            eventAction: "charts_page",
            eventContext: query,
        })
    }

    logSearchClick(query: string, position: string, url: string) {
        this.logToGA({
            event: EventCategory.SiteSearchClick,
            eventAction: "click",
            eventContext: { query, position },
            eventTarget: url,
        })
    }
}
