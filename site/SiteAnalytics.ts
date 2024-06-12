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
        cardPosition,
        positionWithinCard,
        filter,
    }: {
        query: string
        position: string
        positionInSection: string
        cardPosition?: string
        positionWithinCard?: string
        url: string
        filter: SearchCategoryFilter
    }) {
        this.logToGA({
            event: EventCategory.SiteSearchClick,
            eventAction: "click",
            eventContext: JSON.stringify({
                query,
                position,
                positionInSection,
                cardPosition,
                positionWithinCard,
                filter,
            }),
            eventTarget: url,
        })
    }

    logInstantSearchClick({
        query,
        url,
        position,
    }: {
        query: string
        url: string
        position: string
    }) {
        this.logToGA({
            event: EventCategory.SiteInstantSearchClick,
            eventAction: "click",
            eventContext: JSON.stringify({ query, position }),
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

    logDodShown(id: string) {
        this.logToGA({
            event: EventCategory.DetailOnDemand,
            eventAction: "show",
            eventTarget: id,
        })
    }
}
