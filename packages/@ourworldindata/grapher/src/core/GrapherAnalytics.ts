import { findDOMParent } from "@ourworldindata/utils"

const DEBUG = false

// Add type information for dataLayer global provided by Google Tag Manager
type WindowWithDataLayer = Window & {
    dataLayer?: (GAEvent | GAConsent)[]
}
declare const window: WindowWithDataLayer

export enum EventCategory {
    CountryProfileSearch = "owid.country_profile_search",
    Filter = "owid.filter",
    GlobalEntitySelectorUsage = "owid.global_entity_selector_usage",
    GrapherView = "owid.grapher_view",
    GrapherClick = "owid.grapher_click",
    GrapherHover = "owid.grapher_hover",
    GrapherError = "owid.grapher_error",
    GrapherEntitySelector = "owid.grapher_entity_selector",
    ExplorerView = "owid.explorer_view",
    Expander = "owid.expander",
    ExplorerCountrySelector = "owid.explorer_country_selector",
    Hover = "owid.hover",
    KeyboardShortcut = "owid.keyboard_shortcut",
    SiteClick = "owid.site_click",
    SiteError = "owid.site_error",
    SiteSearchClick = "owid.site_search_click",
    SiteSearchFilterClick = "owid.site_search_filter_click",
    SiteInstantSearchClick = "owid.site_instantsearch_click",
    SiteSearchResultClick = "owid.site_search_result_click",
    SiteSearchAutocompleteClick = "owid.site_search_autocomplete_click",
    SiteFormSubmit = "owid.site_form_submit",
    DetailOnDemand = "owid.detail_on_demand",
    DataCatalogSearch = "owid.data_catalog_search",
    SiteGuidedChartLinkClick = "owid.site_guided_chart_link_click",
    SiteChartPreviewMouseover = "owid.site_chart_preview_mouseover",
}

enum EventAction {
    grapherViewError = "grapher_view_error",
    entitiesNotFound = "entities_not_found",
    timelinePlay = "timeline_play",
}

type EntityControlEvent = "open" | "change" | "close"
export type EntitySelectorEvent =
    | "enter"
    | "select"
    | "deselect"
    | "sortBy"
    | "sortOrder"
    | "filterBy"
    | "clear"

export type GrapherImageDownloadEvent =
    | "chart_download_png"
    | "chart_download_svg"

export type GrapherInteractionEvent =
    | "map_country_hover" // hover over a country in the map or on the globe
    | "map_legend_hover" // hover over a legend item on the map tab

export interface GrapherAnalyticsContext {
    slug?: string
    viewConfigId?: string
    narrativeChartName?: string
}

interface GAEvent {
    event: EventCategory
    eventAction?: string
    eventContext?: string
    eventTarget?: string
    grapherPath?: string
    viewConfigId?: string // specifies a view in a multi-dim data page
    narrativeChartName?: string // specifies the name of a narrative chart
    explorerPath?: string
    explorerView?: string
    autocompleteQuery?: string
    autocompletePosition?: number
    autocompleteFilterType?: string
    autocompleteFilterName?: string
    autocompleteSuggestions?: string
    autocompleteSuggestionsTypes?: string
    autocompleteSuggestionsCount?: number
}

// taken from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/de66435d18fbdb2684947d16b5cd3a77f876324c/types/gtag.js/index.d.ts#L151-L156
interface GAConsentParams {
    ad_storage?: "granted" | "denied" | undefined
    analytics_storage?: "granted" | "denied" | undefined
    wait_for_update?: number | undefined
    region?: string[] | undefined
}

type GAConsent = ["consent", "default" | "update", GAConsentParams]

// Note: consent-based blocking dealt with at the Google Tag Manager level.
// Events are discarded if consent not given.
export class GrapherAnalytics {
    constructor(environment: string = "", version = "1.0.0") {
        this.isDev = environment === "development"
        this.version = version
    }

    private version: string // Ideally the Git hash commit
    private isDev: boolean

    logGrapherView(
        slug: string,
        ctx?: { viewConfigId?: string; narrativeChartName?: string }
    ): void {
        this.logToGA({
            event: EventCategory.GrapherView,
            grapherPath: `/grapher/${slug}`,
            viewConfigId: ctx?.viewConfigId,
            narrativeChartName: ctx?.narrativeChartName,
        })
    }

    logGrapherViewError(error: Error): void {
        this.logToGA({
            event: EventCategory.GrapherError,
            eventAction: EventAction.grapherViewError,
            eventContext: error.message,
        })
    }

    logEntitiesNotFoundError(entities: string[]): void {
        this.logToGA({
            event: EventCategory.GrapherError,
            eventAction: EventAction.entitiesNotFound,
            eventContext: JSON.stringify(entities),
        })
    }

    logExplorerView(slug: string, view: Record<string, string>): void {
        this.logToGA({
            event: EventCategory.ExplorerView,
            explorerPath: `/explorers/${slug}`,
            explorerView: JSON.stringify(view),
        })
    }

    /** Logs events for the globel entity selector used on country pages */
    logGlobalEntitySelector(action: EntityControlEvent, note?: string): void {
        this.logToGA({
            event: EventCategory.GlobalEntitySelectorUsage,
            eventAction: action,
            eventContext: note,
        })
    }

    /** Logs events for the explorer's entity selector */
    logEntityPickerEvent(action: EntitySelectorEvent, note?: string): void {
        this.logToGA({
            event: EventCategory.ExplorerCountrySelector,
            eventAction: action,
            eventContext: note,
        })
    }

    /** Logs events for Grapher's entity selector */
    logEntitySelectorEvent(
        action: EntitySelectorEvent,
        ctx: GrapherAnalyticsContext & { target?: string }
    ): void {
        this.logToGA({
            ...grapherAnalyticsContextToGAEventFields(ctx),
            event: EventCategory.GrapherEntitySelector,
            eventAction: action,
            eventTarget: ctx.target,
        })
    }

    logGrapherImageDownloadEvent(
        action: GrapherImageDownloadEvent,
        ctx: GrapherAnalyticsContext & { context?: Record<string, any> }
    ): void {
        this.logToGA({
            ...grapherAnalyticsContextToGAEventFields(ctx),
            event: EventCategory.GrapherClick,
            eventAction: action,
            eventContext: ctx.context ? JSON.stringify(ctx.context) : undefined,
        })
    }

    logGrapherInteractionEvent(
        action: GrapherInteractionEvent,
        ctx: GrapherAnalyticsContext & { target?: string }
    ): void {
        this.logToGA({
            ...grapherAnalyticsContextToGAEventFields(ctx),
            event: EventCategory.GrapherHover,
            eventAction: action,
            eventTarget: ctx.target,
        })
    }

    logGrapherClick(
        action: string = "unknown-action",
        ctx: {
            label?: string
            grapherUrl?: string
            narrativeChartName?: string
        }
    ): void {
        this.logToGA({
            event: EventCategory.GrapherClick,
            eventAction: action,
            eventTarget: ctx.label,
            grapherPath: getPathname(ctx.grapherUrl),
            narrativeChartName: ctx.narrativeChartName,
        })
    }

    logSiteClick(action: string = "unknown-action", label?: string): void {
        this.logToGA({
            event: EventCategory.SiteClick,
            eventAction: action,
            eventTarget: label,
        })
    }

    logSiteFormSubmit(action: string, label?: string): void {
        this.logToGA({
            event: EventCategory.SiteFormSubmit,
            eventAction: action,
            eventTarget: label,
        })
    }

    logKeyboardShortcut(shortcut: string, combo: string): void {
        this.logToGA({
            event: EventCategory.KeyboardShortcut,
            eventAction: shortcut,
            eventContext: combo,
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

    protected logToGA(event: GAEvent): void {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log("Analytics.logToGA", event)
            return
        }
        if (typeof window !== "undefined") window.dataLayer?.push(event)
    }

    updateGAConsentSettings(consent: GAConsentParams): void {
        function pushToDataLayer(..._args: any): void {
            // Google Tag Manager is super weird here: it will not accept a normal array or object
            // being pushed to dataLayer, it absolutely has to be an `Arguments` object.
            // see https://stackoverflow.com/q/60400130/10670163

            // eslint-disable-next-line prefer-rest-params
            window.dataLayer?.push(arguments as unknown as GAConsent)
        }
        pushToDataLayer("consent", "update", consent)
    }
}

function getPathname(url?: string): string | undefined {
    // GA4 trims metadata fields down to 100 characters, so we want to be concise and only send
    // the pathname, e.g. `/grapher/life-expectancy` or `/explorers/migration`
    if (url === undefined) return undefined

    try {
        const urlObj = new URL(url)
        return urlObj.pathname
    } catch {
        // Invalid URL, return undefined
        return undefined
    }
}

function grapherAnalyticsContextToGAEventFields(
    ctx: GrapherAnalyticsContext
): Partial<GAEvent> {
    return {
        grapherPath: ctx.slug ? `/grapher/${ctx.slug}` : undefined,
        viewConfigId: ctx.viewConfigId,
        narrativeChartName: ctx.narrativeChartName,
    }
}
