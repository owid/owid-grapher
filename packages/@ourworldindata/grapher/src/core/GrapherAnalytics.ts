import {
    EventCategory,
    GrapherErrorAction,
    type EntityControlEvent,
    type EntitySelectorEvent,
    type GrapherImageDownloadEvent,
    type GrapherInteractionEvent,
    type GrapherAnalyticsContext,
    type GAEvent,
} from "@ourworldindata/types"

const DEBUG = false

type GAEventWithClear = GAEvent & { _clear: boolean }

// Add type information for dataLayer global provided by Google Tag Manager
type WindowWithDataLayer = Window & {
    dataLayer?: (GAEventWithClear | GAConsent)[]
}
declare const window: WindowWithDataLayer

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
            eventAction: GrapherErrorAction.GrapherViewError,
            eventContext: error.message,
        })
    }

    logEntitiesNotFoundError(entities: string[]): void {
        this.logToGA({
            event: EventCategory.GrapherError,
            eventAction: GrapherErrorAction.EntitiesNotFound,
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

    logSiteFormSubmit(
        action: "newsletter-subscribe" | "donate",
        label?: string
    ): void {
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

    protected logToGA(event: GAEvent): void {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log("Analytics.logToGA", event)
            return
        }
        if (typeof window !== "undefined") {
            // It's very important that we clear (_clear) the data layer whenever we push an event,
            // otherwise it will retain all properties from previous events which can lead to
            // confusing and incorrect events data being sent.
            // See https://www.simoahava.com/analytics/two-simple-data-model-tricks/.
            // see also https://github.com/google/data-layer-helper/blob/4a65b385db1fac710d33bf5d1345e598e3d117fc/README.md#preventing-default-recursive-merge
            window.dataLayer?.push({ ...event, _clear: true })
        }
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
