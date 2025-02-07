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
    GrapherError = "owid.grapher_error",
    ExplorerView = "owid.explorer_view",
    ExplorerCountrySelector = "owid.explorer_country_selector",
    Hover = "owid.hover",
    KeyboardShortcut = "owid.keyboard_shortcut",
    SiteClick = "owid.site_click",
    SiteError = "owid.site_error",
    SiteSearchClick = "owid.site_search_click",
    SiteSearchFilterClick = "owid.site_search_filter_click",
    SiteInstantSearchClick = "owid.site_instantsearch_click",
    SiteFormSubmit = "owid.site_form_submit",
    DetailOnDemand = "owid.detail_on_demand",
    DataCatalogSearch = "owid.data_catalog_search",
    DataCatalogResultClick = "owid.data_catalog_result_click",
}

enum EventAction {
    grapherViewError = "grapher_view_error",
    entitiesNotFound = "entities_not_found",
    timelinePlay = "timeline_play",
}

type entityControlEvent = "open" | "change" | "close"
type countrySelectorEvent =
    | "enter"
    | "select"
    | "deselect"
    | "sortBy"
    | "sortOrder"

interface GAEvent {
    event: EventCategory
    eventAction?: string
    eventContext?: string
    eventTarget?: string
    grapherPath?: string
    grapherView?: string // specifies a view in a multi-dim data page
    chartViewName?: string // specifies the name of a chart view / narrative chart
    explorerPath?: string
    explorerView?: string
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
        ctx?: { view?: Record<string, string>; chartViewName?: string }
    ): void {
        this.logToGA({
            event: EventCategory.GrapherView,
            grapherPath: `/grapher/${slug}`,
            grapherView: ctx?.view ? JSON.stringify(ctx.view) : undefined,
            chartViewName: ctx?.chartViewName,
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

    logGlobalEntitySelector(action: entityControlEvent, note?: string): void {
        this.logToGA({
            event: EventCategory.GlobalEntitySelectorUsage,
            eventAction: action,
            eventContext: note,
        })
    }

    logEntityPickerEvent(action: countrySelectorEvent, note?: string): void {
        this.logToGA({
            event: EventCategory.ExplorerCountrySelector,
            eventAction: action,
            eventContext: note,
        })
    }

    logGrapherClick(
        action: string = "unknown-action",
        ctx: {
            label?: string
            grapherUrl?: string
            chartViewName?: string
        }
    ): void {
        // GA4 trims metadata fields down to 100 characters, so we want to be concise and only send
        // the pathname, e.g. `/grapher/life-expectancy` or `/explorers/migration`
        const grapherUrlObj =
            ctx.grapherUrl !== undefined ? new URL(ctx.grapherUrl) : undefined

        this.logToGA({
            event: EventCategory.GrapherClick,
            eventAction: action,
            eventTarget: ctx.label,
            grapherPath: grapherUrlObj?.pathname,
            chartViewName: ctx.chartViewName,
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
        // const _dataTrackAttr = "data-track-note"
        // we set a data-grapher-url attr on grapher charts to indicate the URL of the chart.
        // this is helpful for tracking clicks on charts that are embedded in articles, where we would like to know
        // which chart the user is interacting with
        // const _dataGrapherUrlAttr = "data-grapher-url"
        // TODO: 2025-01-05 Daniel - re-enable this before deploying
        // document.addEventListener(
        //     "click",
        //     async (ev) => {
        //         const targetElement = ev.target as HTMLElement
        //         const trackedElement = findDOMParent(
        //             targetElement,
        //             (el: HTMLElement) => el.getAttribute(dataTrackAttr) !== null
        //         )
        //         if (!trackedElement) return
        //             const grapherUrlRaw = trackedElement
        //                 .closest(`[${dataGrapherUrlAttr}]`)
        //                 ?.getAttribute(dataGrapherUrlAttr)
        //             if (grapherUrlRaw) {
        //                 let grapherUrlObj:
        //                     | {
        //                           grapherUrl: string
        //                           chartViewName: string
        //                       }
        //                     | undefined
        //                 try {
        //                     grapherUrlObj = JSON.parse(grapherUrlRaw)
        //                 } catch (e) {
        //                     console.warn("failed to parse grapherUrl", e)
        //                 }
        //                 this.logGrapherClick(
        //                     trackedElement.getAttribute(dataTrackAttr) || undefined,
        //                     {
        //                         label: trackedElement.innerText,
        //                         grapherUrl: grapherUrlObj?.grapherUrl,
        //                         chartViewName: grapherUrlObj?.chartViewName,
        //                     }
        //                 )
        //             } else
        //                 this.logSiteClick(
        //                     trackedElement.getAttribute(dataTrackAttr) || undefined,
        //                     trackedElement.innerText
        //                 )
        //         },
        //         { capture: true, passive: true }
        //     )
    }

    protected logToGA(event: GAEvent): void {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log("Analytics.logToGA", event)
            return
        }

        window.dataLayer?.push(event)
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
