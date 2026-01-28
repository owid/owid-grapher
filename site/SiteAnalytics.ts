import * as _ from "lodash-es"
import { GrapherAnalytics, splitPathForGA4 } from "@ourworldindata/grapher"
import { EventCategory } from "@ourworldindata/types"
import {
    type SearchChartHit,
    type SearchState,
    type FlatArticleHit,
    type TopicPageHit,
    type DataInsightHit,
    type StackedArticleHit,
    FilterType,
} from "@ourworldindata/types"
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
        const { path: target, pathNext: targetNext } = splitPathForGA4(url)
        this.logToGA({
            event: EventCategory.SiteGuidedChartLinkClick,
            eventAction: "click",
            eventTarget: target,
            eventTargetNext: targetNext,
        })
    }

    logChartPreviewMouseover(chartUrl: string) {
        const { path: target, pathNext: targetNext } = splitPathForGA4(chartUrl)
        this.logToGA({
            event: EventCategory.SiteChartPreviewMouseover,
            eventAction: "mouseover",
            eventTarget: target,
            eventTargetNext: targetNext,
        })
    }

    /**
     * Logs analytics events for static visualization downloads.
     * @param staticVizName - The unique name identifier of the static viz
     * @param action - The type of download: 'image_download' for PNG exports,
     *                 'data_download' for CSV downloads, or 'source_link_click' for external source links
     * @param context - Optional context such as 'desktop'/'mobile' for images, or the URL for data/source links
     */
    logStaticVizDownload(
        staticVizName: string,
        action: "image_download" | "data_download" | "source_link_click",
        context?: string
    ) {
        this.logToGA({
            event: EventCategory.SiteStaticVizDownload,
            eventAction: action,
            eventTarget: staticVizName,
            eventContext: context,
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

    private logBrowserTranslationEvent(ctx: {
        from: string | null
        to: string | null
    }) {
        const browserLanguages =
            navigator.languages || [navigator.language] || []

        this.logToGA({
            event: EventCategory.TranslatePage,
            eventTarget: JSON.stringify(ctx),
            eventContext: browserLanguages.join(","),
        })
    }

    // Add a listener to detect browser translation events
    startDetectingBrowserTranslation() {
        const htmlElement = document.documentElement
        const initialLang = htmlElement.getAttribute("lang")

        const sendTranslationAnalyticsEvent = (
            prevLang: string | null,
            newLang: string | null
        ) => {
            const ctx = { from: prevLang, to: newLang }

            // eslint-disable-next-line no-console
            console.info("Browser translation detected", ctx)

            this.logBrowserTranslationEvent(ctx)
        }

        // Create a MutationObserver to watch for changes to the HTML which are signposts
        // of a translation service / browser translation.
        const observer = new MutationObserver((mutations) => {
            // Chrome sometimes fires two of the same mutations in a row, so we deduplicate here:
            const mutationsUniq = _.uniqBy(mutations, (m) =>
                [m.attributeName, m.oldValue].join("-")
            )

            mutationsUniq.forEach((mutation) => {
                if (!mutation.attributeName) return

                const target = mutation.target as HTMLElement
                const newValue = target.getAttribute(mutation.attributeName)

                let prevLang: string | null = null,
                    newLang: string | null = null

                if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "lang"
                ) {
                    newLang = newValue
                    prevLang = mutation.oldValue

                    if (prevLang === newLang) {
                        // In Safari, it sometimes happens that we receive mutations that don't change the lang attribute
                        return
                    }

                    sendTranslationAnalyticsEvent(prevLang, newLang)
                } else if (
                    mutation.type === "attributes" &&
                    mutation.attributeName === "_msthash"
                ) {
                    if (mutation.oldValue === null) {
                        prevLang = initialLang
                    } else if (newValue === null) {
                        newLang = initialLang
                    } else {
                        // Don't handle events where both old and new values are non-null - this might mean that the title changed and was re-translated
                        return
                    }

                    sendTranslationAnalyticsEvent(prevLang, newLang)
                }
            })
        })

        // Observe <html lang="...">, which is changed by most browser translation services
        observer.observe(htmlElement, {
            attributes: true,
            attributeFilter: ["lang"],
            attributeOldValue: true,
        })

        // Observe <title _msthash="...">, which is changed by Microsoft Edge translation
        const titleElement = document.head.querySelector("title")
        if (titleElement) {
            observer.observe(titleElement, {
                attributes: true,
                attributeFilter: ["_msthash"],
                attributeOldValue: true,
            })
        }
    }
}
