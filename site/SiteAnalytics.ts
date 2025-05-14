import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"
import {
    type SearchCategoryFilter,
    type IDataCatalogHit,
    type SearchState,
    FilterType,
} from "./search/searchTypes.js"
import { set } from "@ourworldindata/utils"
import { getFilterNamesOfType } from "./search/searchUtils.js"

export class SiteAnalytics extends GrapherAnalytics {
    logPageNotFoundError(url: string) {
        this.logToGA({
            event: EventCategory.SiteError,
            eventAction: "not_found",
            eventContext: url,
        })
    }

    logCountryPageSearchQuery(query: string) {
        this.logToGA({
            event: EventCategory.Filter,
            eventAction: "country_page_search",
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

    logDataCatalogSearch(state: SearchState) {
        this.logToGA({
            event: EventCategory.DataCatalogSearch,
            eventAction: "search",
            eventContext: JSON.stringify({
                ...state,
                topics: Array.from(
                    getFilterNamesOfType(state.filters, FilterType.TOPIC)
                ),
                selectedCountryNames: Array.from(
                    getFilterNamesOfType(state.filters, FilterType.COUNTRY)
                ),
            }),
        })
    }

    logDataCatalogResultClick(
        hit: IDataCatalogHit,
        position: number,
        source: "ribbon" | "search",
        ribbonTag?: string
    ) {
        const eventContext = {
            position,
            source,
        }
        if (ribbonTag) set(eventContext, "ribbonTag", ribbonTag)
        this.logToGA({
            event: EventCategory.DataCatalogResultClick,
            eventAction: "click",
            eventContext: JSON.stringify(eventContext),
            eventTarget: hit.slug,
        })
    }

    logExpanderToggle(id: string, isOpen: boolean) {
        this.logToGA({
            event: EventCategory.Expander,
            eventAction: isOpen ? "open" : "close",
            eventTarget: id,
        })
    }
}
