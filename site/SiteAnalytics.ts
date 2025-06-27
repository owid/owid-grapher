import * as _ from "lodash-es"
import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"
import {
    type SearchCategoryFilter,
    type SearchChartHit,
    type SearchState,
    FilterType,
} from "./search/searchTypes.js"
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

    logSearch(state: SearchState) {
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
        hit: SearchChartHit,
        position: number,
        source: "ribbon" | "search",
        ribbonTag?: string
    ) {
        const eventContext = {
            position,
            source,
        }
        if (ribbonTag) _.set(eventContext, "ribbonTag", ribbonTag)
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

    logSearchAutocompleteClick({
        query,
        position,
        filterType,
        filterName,
        suggestions,
        suggestionsTypes,
        suggestionsCount,
    }: {
        query: string
        position: number
        filterType: FilterType
        filterName: string
        suggestions: string[]
        suggestionsTypes: FilterType[]
        suggestionsCount: number
    }) {
        this.logToGA({
            event: EventCategory.SiteSearchAutocompleteClick,
            eventAction: "click",
            autocompleteQuery: query,
            autocompletePosition: position,
            autocompleteFilterType: filterType,
            autocompleteFilterName: filterName,
            autocompleteSuggestions: suggestions.join("~"), // not JSON.stringify to avoid broken JSON above 100 character limit
            autocompleteSuggestionsTypes: suggestionsTypes.join("~"),
            autocompleteSuggestionsCount: suggestionsCount,
        })
    }

    logGuidedChartLinkClick(url: string) {
        this.logToGA({
            event: EventCategory.SiteGuidedChartLinkClick,
            eventAction: "click",
            eventTarget: url,
        })
    }

    logChartPreviewMouseover(chartUrl: string) {
        this.logToGA({
            event: EventCategory.SiteChartPreviewMouseover,
            eventAction: "mouseover",
            eventTarget: chartUrl,
        })
    }
}
