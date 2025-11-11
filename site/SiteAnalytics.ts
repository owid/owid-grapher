import * as _ from "lodash-es"
import { GrapherAnalytics } from "@ourworldindata/grapher"
import { EventCategory } from "@ourworldindata/types"
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
import { findDOMParent } from "@ourworldindata/utils"

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
        const topics = Array.from(
            getFilterNamesOfType(state.filters, FilterType.TOPIC)
        )
        const selectedCountryNames = Array.from(
            getFilterNamesOfType(state.filters, FilterType.COUNTRY)
        )

        this.logToGA({
            event: EventCategory.SiteSearch,
            eventAction: "search",
            searchQuery: state.query || "",
            searchRequireAllCountries: state.requireAllCountries,
            searchResultType: state.resultType || "",
            searchTopics: topics.join("~"),
            searchSelectedCountries: selectedCountryNames.join("~"),
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
            vizType?: string | null
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

    startClickTracking(): void {
        // we use a data-track-note attr on elements to indicate that clicks on them should be tracked, and what to send
        const dataTrackAttr = "data-track-note"
        // we set a data-grapher-url attr on grapher charts to indicate the URL of the chart.
        // this is helpful for tracking clicks on charts that are embedded in articles, where we would like to know
        // which chart the user is interacting with
        const dataGrapherUrlAttr = "data-grapher-url"
        document.addEventListener(
            "click",
            async (ev) => {
                const targetElement = ev.target as HTMLElement
                const trackedElement = findDOMParent(
                    targetElement,
                    (el: HTMLElement) => el.getAttribute(dataTrackAttr) !== null
                )
                if (!trackedElement) return
                const grapherUrlRaw = trackedElement
                    .closest(`[${dataGrapherUrlAttr}]`)
                    ?.getAttribute(dataGrapherUrlAttr)
                if (grapherUrlRaw) {
                    let grapherUrlObj:
                        | {
                              grapherUrl: string
                              narrativeChartName: string
                          }
                        | undefined
                    try {
                        grapherUrlObj = JSON.parse(grapherUrlRaw)
                    } catch (e) {
                        console.warn("failed to parse grapherUrl", e)
                    }
                    this.logGrapherClick(
                        trackedElement.getAttribute(dataTrackAttr) || undefined,
                        {
                            label: trackedElement.innerText,
                            grapherUrl: grapherUrlObj?.grapherUrl,
                            narrativeChartName:
                                grapherUrlObj?.narrativeChartName,
                        }
                    )
                } else
                    this.logSiteClick(
                        trackedElement.getAttribute(dataTrackAttr) || undefined,
                        trackedElement.innerText
                    )
            },
            { capture: true, passive: true }
        )
    }
}
