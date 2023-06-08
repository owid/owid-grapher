import { findDOMParent } from "@ourworldindata/utils"

const DEBUG = false

// Add type information for dataLayer global provided by Google Tag Manager
type WindowWithDataLayer = Window & {
    dataLayer?: GAEvent[]
}
declare const window: WindowWithDataLayer

export enum EventCategory {
    CountryProfileSearch = "owid.country_profile_search",
    Filter = "owid.filter",
    GlobalEntitySelectorUsage = "owid.global_entity_selector_usage",
    GrapherClick = "owid.grapher_click",
    GrapherError = "owid.grapher_error",
    GrapherUsage = "owid.grapher_usage",
    ExplorerCountrySelector = "owid.explorer_country_selector",
    Hover = "owid.hover",
    KeyboardShortcut = "owid.keyboard_shortcut",
    SiteClick = "owid.site_click",
    SiteError = "owid.site_error",
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
    grapherUrl?: string
}

// Note: consent-based blocking dealt with at the Google Tag Manager level.
// Events are discarded if consent not given.
export class GrapherAnalytics {
    constructor(environment: string = "", version = "1.0.0") {
        this.isDev = environment === "development"
        this.version = version
    }

    private version: string // Ideally the Git hash commit
    private isDev: boolean

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
        label?: string,
        grapherUrl?: string
    ): void {
        // GA4 trims metadata fields down to 100 characters, so we want to be concise
        const grapherUrlObj =
            grapherUrl !== undefined ? new URL(grapherUrl) : undefined

        this.logToGA({
            event: EventCategory.GrapherClick,
            eventAction: action,
            eventTarget: label,
            grapherUrl: grapherUrlObj?.pathname,
        })
    }

    logSiteClick(action: string = "unknown-action", label?: string): void {
        this.logToGA({
            event: EventCategory.SiteClick,
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
        // Todo: add a Story and tests for this OR even better remove and use Google Tag Manager or similar fully SAAS tracking.
        // Todo: have different Attributes for Grapher charts vs Site.
        const dataTrackAttr = "data-track-note"
        const dataGrapherUrlAttr = "data-grapher-url"
        document.addEventListener("click", async (ev) => {
            const targetElement = ev.target as HTMLElement
            const trackedElement = findDOMParent(
                targetElement,
                (el: HTMLElement) => el.getAttribute(dataTrackAttr) !== null
            )
            if (!trackedElement) return

            const grapherUrl = trackedElement
                .closest(`[${dataGrapherUrlAttr}]`)
                ?.getAttribute(dataGrapherUrlAttr)

            if (grapherUrl)
                this.logGrapherClick(
                    trackedElement.getAttribute(dataTrackAttr) || undefined,
                    trackedElement.innerText,
                    grapherUrl
                )
            else
                this.logSiteClick(
                    trackedElement.getAttribute(dataTrackAttr) || undefined,
                    trackedElement.innerText
                )
        })
    }

    protected logToGA(event: GAEvent): void {
        if (DEBUG && this.isDev) {
            // eslint-disable-next-line no-console
            console.log("Analytics.logToGA", event)
            return
        }

        window.dataLayer?.push(event)
    }
}
