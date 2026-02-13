// Analytics Type System
//
// This file defines the complete contract between the frontend and analytics backend.
// Each event category has exactly one corresponding parameter interface.
// TypeScript enforces you can't send wrong parameters for an event.
//
// IMPORTANT GUIDELINES FOR ANALYTICS BACKEND:
//
// 1. GA4 100-Character Limit:
//    - GA4 truncates ALL string parameters at exactly 100 characters
//    - Use separate typed parameters instead of JSON in eventContext
//    - Example: searchQuery, searchTopics (separate params)
//      is better than eventContext: JSON.stringify({query, topics})
//
// 2. Register Custom Parameters in Google Tag Manager:
//    - After adding new parameters, you MUST register them in GTM
//    - Go to: https://tagmanager.google.com/#/container/accounts/4702630479/containers/12712743/workspaces/50/tags
//    - Without registration, custom parameters won't be collected by GA4
//
// 3. This file is the single source of truth for the analytics contract

import { JsonString } from "../domainTypes/Various.js"

// =============================================================================
// EVENT CATEGORIES
// =============================================================================

export enum EventCategory {
    Filter = "owid.filter",
    GrapherView = "owid.grapher_view",
    GrapherClick = "owid.grapher_click",
    GrapherHover = "owid.grapher_hover",
    GrapherError = "owid.grapher_error",
    GrapherEntitySelector = "owid.grapher_entity_selector",
    ExplorerView = "owid.explorer_view",
    Expander = "owid.expander",
    ExplorerCountrySelector = "owid.explorer_country_selector",
    KeyboardShortcut = "owid.keyboard_shortcut",
    SiteClick = "owid.site_click",
    SiteError = "owid.site_error",
    SiteInstantSearchClick = "owid.site_instantsearch_click",
    SiteSearch = "owid.site_search",
    SiteSearchAutocompleteClick = "owid.site_search_autocomplete_click",
    SiteSearchResultClick = "owid.site_search_result_click",
    SiteFormSubmit = "owid.site_form_submit",
    DetailOnDemand = "owid.detail_on_demand",
    SiteGuidedChartLinkClick = "owid.site_guided_chart_link_click",
    SiteChartPreviewMouseover = "owid.site_chart_preview_mouseover",
    SiteStaticVizDownload = "owid.site_static_viz_download",
    SiteUserSurvey = "owid.site_user_survey",
    TranslatePage = "owid.translate_page",
}

// =============================================================================
// EVENT-TO-PARAMETER MAPPING
// =============================================================================

export type EventParamsMap = {
    [EventCategory.SiteSearch]: SiteSearchParams
    [EventCategory.SiteSearchAutocompleteClick]: SiteSearchAutocompleteClickParams
    [EventCategory.SiteSearchResultClick]: SiteSearchResultClickParams
    [EventCategory.GrapherView]: GrapherViewParams
    [EventCategory.GrapherClick]: GrapherClickParams
    [EventCategory.GrapherHover]: GrapherHoverParams
    [EventCategory.GrapherError]: GrapherErrorParams
    [EventCategory.GrapherEntitySelector]: GrapherEntitySelectorParams
    [EventCategory.ExplorerView]: ExplorerViewParams
    [EventCategory.ExplorerCountrySelector]: ExplorerCountrySelectorParams
    [EventCategory.DetailOnDemand]: DetailOnDemandParams
    [EventCategory.Expander]: ExpanderParams
    [EventCategory.KeyboardShortcut]: KeyboardShortcutParams
    [EventCategory.SiteGuidedChartLinkClick]: SiteGuidedChartLinkClickParams
    [EventCategory.SiteChartPreviewMouseover]: SiteChartPreviewMouseoverParams
    [EventCategory.SiteStaticVizDownload]: SiteStaticVizDownloadParams
    [EventCategory.SiteUserSurvey]: SiteUserSurveyParams
    [EventCategory.SiteClick]: SiteClickParams
    [EventCategory.SiteFormSubmit]: SiteFormSubmitParams
    [EventCategory.SiteInstantSearchClick]: SiteInstantSearchClickParams
    [EventCategory.SiteError]: SiteErrorParams
    [EventCategory.Filter]: FilterParams
    [EventCategory.TranslatePage]: TranslatePageParams
}

export type GAEvent = {
    [K in EventCategory]: { event: K } & EventParamsMap[K]
}[EventCategory]

// =============================================================================
// EVENT PARAMETER INTERFACES
// =============================================================================

// Site Events

export interface SiteSearchParams {
    /** Always 'search' for this event */
    eventAction: "search"
    /** Search query entered by user */
    searchQuery: string
    /** Whether 'all countries' filter is enabled */
    searchRequireAllCountries: boolean
    /** Type of results displayed ('all', 'data', 'articles', etc.) */
    searchResultType: string
    /** Tilde-separated list of selected topic names */
    searchTopics: string
    /** Tilde-separated list of selected country names */
    searchSelectedCountries: string
}

export interface SiteSearchAutocompleteClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** Search query when autocomplete was clicked */
    autocompleteQuery: string
    /** Position of selected suggestion (0-indexed) */
    autocompletePosition: number
    /** Type of selected filter ('topic' | 'country' | 'query') */
    autocompleteFilterType: string
    /** Name of the selected filter (e.g., 'France', 'Health') */
    autocompleteFilterName: string
    /** Tilde-separated list of all suggestions shown */
    autocompleteSuggestions: string
    /** Tilde-separated list of suggestion types */
    autocompleteSuggestionsTypes: string
    /** Total number of suggestions displayed */
    autocompleteSuggestionsCount: number
}

export interface SiteSearchResultClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** JSON string with context about the clicked result */
    eventContext: string
    /** Target URL of the clicked result */
    eventTarget: string
}

export interface SiteClickParams {
    /** Action type */
    eventAction: string
    /** Target element or label */
    eventTarget?: string
}

export interface SiteFormSubmitParams {
    /** Action type - form submission type */
    eventAction: "newsletter-subscribe" | "donate"
    /** Target element or label */
    eventTarget?: string
}

export interface SiteInstantSearchClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** JSON context with query and position */
    eventContext: string
    /** Target URL */
    eventTarget: string
}

export interface SiteErrorParams {
    /** Action type (e.g., 'not_found') */
    eventAction: string
    /** Error details or URL */
    eventContext: string
}

export interface SiteGuidedChartLinkClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** Target URL or chart path */
    eventTarget: string
    /** Continuation of eventTarget for URLs > 100 chars (characters 101-200) */
    eventTargetNext?: string
    /** Grapher path of the linked chart (optional - may use eventTarget instead) */
    grapherPath?: string
}

export interface SiteChartPreviewMouseoverParams {
    /** Always 'mouseover' for this event */
    eventAction: "mouseover"
    /** Target chart URL */
    eventTarget: string
    /** Continuation of eventTarget for URLs > 100 chars (characters 101-200) */
    eventTargetNext?: string
    /** Explorer path if in explorer */
    explorerPath?: string
    /** Grapher path being previewed */
    grapherPath?: string
}

export interface SiteStaticVizDownloadParams {
    /** Type of download action */
    eventAction: "image_download" | "data_download" | "source_link_click"
    /** Name of the static viz */
    eventTarget: string
    /** Additional context (e.g., 'desktop' or 'mobile' for images, URL for data/source) */
    eventContext?: string
}

export type UserSurveyExperimentArm = "long-list" | "short-list" | "free-form"

export type UserSurveyRoleAnswer =
    | {
          experimentArm: "free-form"
          freeFormInput: string
      }
    | {
          experimentArm: "long-list" | "short-list"
          optionId: string
          optionLabel: string
          optionIndex: number
          freeFormInput?: string
      }

export type SiteUserSurveyParams =
    | {
          /** Always 'user_role_show' for this event */
          eventAction: "user_role_show"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** First-screen arm for this survey */
          experimentArm: UserSurveyExperimentArm
      }
    | {
          /** Always 'thank_you_show' for this event */
          eventAction: "thank_you_show"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** First-screen arm for this survey */
          experimentArm: UserSurveyExperimentArm
      }
    | {
          /** Always 'user_role_submit' for this event */
          eventAction: "user_role_submit"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** Free-form arm name */
          experimentArm: "free-form"
          /** Text field input from the first screen */
          freeFormInput: string
      }
    | {
          /** Always 'user_role_submit' for this event */
          eventAction: "user_role_submit"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** Choice-based arm names */
          experimentArm: "long-list" | "short-list"
          /** Option id from predefined options */
          optionId: string
          /** Option label from predefined options */
          optionLabel: string
          /** 0-based index of selected option in randomized list */
          optionIndex: number
          /** Optional text field input from the "other" option */
          freeFormInput?: string
      }
    | {
          /** Always 'feedback_submit' for this event */
          eventAction: "feedback_submit"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** First-screen arm for this survey */
          experimentArm: UserSurveyExperimentArm
      }
    | {
          /** Always 'user_role_dismiss' for this event */
          eventAction: "user_role_dismiss"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** First-screen arm for this survey */
          experimentArm: UserSurveyExperimentArm
      }
    | {
          /** Always 'thank_you_dismiss' for this event */
          eventAction: "thank_you_dismiss"
          /** Survey name identifier */
          surveyName: string
          /** Survey instance identifier generated with uuidv7 */
          responseId: string
          /** First-screen arm for this survey */
          experimentArm: UserSurveyExperimentArm
      }

// Grapher Events

export interface GrapherViewParams {
    /** Grapher chart path (e.g., '/grapher/life-expectancy') */
    grapherPath?: string
    /** Continuation of grapherPath for URLs > 100 chars (characters 101-200) */
    grapherPathNext?: string
    /** View configuration ID for multi-dimensional data pages */
    viewConfigId?: string
    /** Name of the narrative chart if embedded */
    narrativeChartName?: string
}

export interface GrapherClickParams {
    /** Action type - image downloads or generic clicks */
    eventAction: GrapherImageDownloadEvent | string
    /** Grapher chart path */
    grapherPath?: string
    /** Continuation of grapherPath for URLs > 100 chars (characters 101-200) */
    grapherPathNext?: string
    /** View configuration ID */
    viewConfigId?: string
    /** Name of narrative chart */
    narrativeChartName?: string
    /** Target element label */
    eventTarget?: string
    /** Additional context as JSON */
    eventContext?: string
}

export interface GrapherHoverParams {
    /** Type of hover interaction */
    eventAction: GrapherInteractionEvent
    /** Grapher chart path */
    grapherPath?: string
    /** Continuation of grapherPath for URLs > 100 chars (characters 101-200) */
    grapherPathNext?: string
    /** View configuration ID */
    viewConfigId?: string
    /** Name of narrative chart */
    narrativeChartName?: string
    /** Target element (e.g., country name) */
    eventTarget?: string
}

export interface GrapherErrorParams {
    /** Type of error */
    eventAction: "grapher_view_error" | "entities_not_found"
    /** Error message or details */
    eventContext: string
    /** Grapher chart path */
    grapherPath?: string
    /** Continuation of grapherPath for URLs > 100 chars (characters 101-200) */
    grapherPathNext?: string
    /** View configuration ID */
    viewConfigId?: string
    /** Name of narrative chart */
    narrativeChartName?: string
}

export interface GrapherEntitySelectorParams {
    /** Entity selector action */
    eventAction: EntitySelectorEvent
    /** Grapher chart path */
    grapherPath?: string
    /** Continuation of grapherPath for URLs > 100 chars (characters 101-200) */
    grapherPathNext?: string
    /** View configuration ID */
    viewConfigId?: string
    /** Name of narrative chart */
    narrativeChartName?: string
    /** Target entity or note */
    eventTarget?: string
}

// Explorer Events

export interface ExplorerViewParams {
    /** Explorer path (e.g., '/explorers/migration') */
    explorerPath: string
    /** JSON string of the explorer view state */
    explorerView: string
    /** Chart config ID of the explorer view */
    viewConfigId?: string
}

export interface ExplorerCountrySelectorParams {
    /** Entity selector action */
    eventAction: EntitySelectorEvent
    /** Additional context */
    eventContext?: string
    /** Explorer path */
    explorerPath?: string
}

// Shared Events

export interface DetailOnDemandParams {
    /** Action type - typically 'show' */
    eventAction: "show" | string
    /** Target element ID */
    eventTarget: string
    /** Explorer path if triggered from explorer */
    explorerPath?: string
    /** Grapher path if triggered from grapher */
    grapherPath?: string
}

export interface ExpanderParams {
    /** Action type - 'open' or 'close' */
    eventAction: "open" | "close"
    /** Target element ID */
    eventTarget: string
    /** Explorer path if in explorer */
    explorerPath?: string
    /** Grapher path if in grapher */
    grapherPath?: string
}

export interface KeyboardShortcutParams {
    /** The keyboard shortcut name */
    eventAction: string
    /** The key combination (e.g., 'Ctrl+K') */
    eventContext: string
    /** Explorer path if in explorer */
    explorerPath?: string
    /** Grapher path if in grapher */
    grapherPath?: string
}

export interface FilterParams {
    /** Always 'country_page_search' for this event */
    eventAction: "country_page_search"
    /** Search query or filter context */
    eventContext: string
}

export interface TranslatePageParams {
    /** Information about the translation event, in the form { from: string | null, to: string | null } */
    eventTarget: JsonString
    /** Comma-separated list of browser languages, e.g.: `es-ES,de-DE,en` */
    eventContext: string
}

// =============================================================================
// EVENT ACTION TYPES & HELPERS
// =============================================================================

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

export enum GrapherErrorAction {
    GrapherViewError = "grapher_view_error",
    EntitiesNotFound = "entities_not_found",
}

export interface GrapherAnalyticsContext {
    slug?: string
    viewConfigId?: string
    narrativeChartName?: string
}
