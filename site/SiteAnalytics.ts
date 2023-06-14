import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"

export class SiteAnalytics extends GrapherAnalytics {
    logCovidCountryProfileSearch(country: string) {
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
}
