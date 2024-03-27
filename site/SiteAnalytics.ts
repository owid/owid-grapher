import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"
import { SearchCategoryFilter } from "./search/searchTypes.js"

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

    logSearchClick({
        query,
        position,
        url,
        positionInSection,
        filter,
    }: {
        query: string
        position: string
        positionInSection: string
        url: string
        filter: SearchCategoryFilter
    }) {
        this.logToGA({
            event: EventCategory.SiteSearchClick,
            eventAction: "click",
            eventContext: { query, position, positionInSection, filter },
            eventTarget: url,
        })
    }

    logSearchFilterClick({ key }: { key: string }) {
        this.logToGA({
            event: EventCategory.SiteSearchFilterClick,
            eventAction: "click",
            eventContext: key,
        })
    }
}
