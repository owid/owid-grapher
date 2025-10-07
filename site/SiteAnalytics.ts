import * as _ from "lodash-es"
import { GrapherAnalytics, EventCategory } from "@ourworldindata/grapher"
import {
    type SearchChartHit,
    type SearchState,
    type FlatArticleHit,
    type TopicPageHit,
    type DataInsightHit,
    type StackedArticleHit,
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

    logDodShown(id: string) {
        this.logToGA({
            event: EventCategory.DetailOnDemand,
            eventAction: "show",
            eventTarget: id,
        })
    }

    logSearch(state: SearchState) {
        this.logToGA({
            event: EventCategory.SiteSearch,
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

    logSiteSearchResultClick(
        hit:
            | SearchChartHit
            | FlatArticleHit
            | TopicPageHit
            | DataInsightHit
            | StackedArticleHit,
        context: {
            position: number
            source: "ribbon" | "search" // "ribbons" are the per-area overview components present on the unparameterized browse pages for writing and data.
            ribbonTag?: string
            vizType?: string
        }
    ) {
        const eventContext = {
            ...context,
            type: hit.type,
        }
        this.logToGA({
            event: EventCategory.SiteSearchResultClick,
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
