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
import { FacetStrategy, GrapherTabName } from "../grapherTypes/GrapherTypes.js"

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
    SiteLatest = "owid.site_latest",
    SiteLatestAnnouncementExpand = "owid.site_latest_announcement_expand",
    SiteLatestResultClick = "owid.site_latest_result_click",
    SitePrint = "owid.site_print",
    SiteSearch = "owid.site_search",
    SiteSearchAutocompleteClick = "owid.site_search_autocomplete_click",
    SiteSearchResultClick = "owid.site_search_result_click",
    SiteFormSubmit = "owid.site_form_submit",
    SiteFindInPage = "owid.site_find_in_page",
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
    [EventCategory.SiteLatest]: SiteLatestParams
    [EventCategory.SiteLatestAnnouncementExpand]: SiteLatestAnnouncementExpandParams
    [EventCategory.SiteLatestResultClick]: SiteLatestResultClickParams
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
    [EventCategory.SiteFindInPage]: SiteFindInPageParams
    [EventCategory.SiteInstantSearchClick]: SiteInstantSearchClickParams
    [EventCategory.SiteError]: SiteErrorParams
    [EventCategory.SitePrint]: SitePrintParams
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

export interface SiteLatestParams {
    /** Always 'filter' for this event */
    eventAction: "filter"
    /** Tilde-separated list of selected topic names. Omitted when no topics
     * are selected. */
    latestTopics?: string
    /** Selected content type. Omitted when the user hasn't picked a type
     * (the "all" filter). */
    latestType?: string
    /** Arm of the /latest sticky filters experiment the visitor is in, if
     * assigned (`exp-latest-sticky-filters-v1` cookie). */
    experimentArm?: string
}

/**
 * Records opening the content represented by a feed preview. Excludes body,
 * author, and CTA links within content already displayed in the feed.
 */
export interface SiteLatestResultClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** Slug of the clicked result */
    eventTarget: string
    /** 1-indexed position of the clicked result in the /latest feed
     * (chronological order, includes all hit types). */
    latestPosition: number
    /** Content type of the clicked result. Always set in practice — only
     * topic/linear-topic pages lack `latestType`, and those never render
     * on /latest. */
    latestType?: string
    /** Arm of the /latest sticky filters experiment the visitor is in, if
     * assigned (`exp-latest-sticky-filters-v1` cookie). */
    experimentArm?: string
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
    /** The clicked element's track note, or an action logged from code */
    eventAction: TrackNote | SiteClickAction
    /** Target element or label */
    eventTarget?: string
}

export interface SiteFormSubmitParams {
    /** Action type - form submission type */
    eventAction: "newsletter-subscribe" | "donate"
    /** Target element or label */
    eventTarget?: string
}

export interface SiteFindInPageParams {
    /** Always 'open': the browser's find shortcut was pressed (logged at most
     * once per page view). The browser never exposes the searched text. */
    eventAction: "open"
    /** The shortcut pressed ('mod+f' or 'f3') */
    eventContext: "mod+f" | "f3"
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
    /** Always 'not_found' for this event */
    eventAction: "not_found"
    /** Error details or URL */
    eventContext: string
}

export interface SitePrintParams {
    /** Always 'beforeprint' for this event; fired when the browser is about to
     * print the page or open its print preview */
    eventAction: "beforeprint"
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
    /** The clicked element's track note, or an image download */
    eventAction: TrackNote | GrapherImageDownloadEvent
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
    /** Chart config ID of the explorer view */
    viewConfigId?: string
}

// Shared Events

export interface DetailOnDemandParams {
    /** Always 'show' for this event */
    eventAction: "show"
    /** Target element ID */
    eventTarget: string
    /** Page region of the DoD span (data pages only, e.g. "wysk", "faqs") */
    eventContext?: string
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

export interface SiteLatestAnnouncementExpandParams {
    /** Always 'expand' for this event — the announcement card's Read more
     * toggle is one-way (no collapse), so there's no 'open'/'close'
     * distinction the way Expander has. */
    eventAction: "expand"
    /** Slug of the announcement that was expanded */
    eventTarget: string
    /** 1-indexed position of the announcement in the /latest feed at the
     * time of expansion (chronological order, includes all hit types). */
    latestPosition: number
    /** Content type of the announcement. One of the announcement
     * `LatestType` subtypes (announcement / data-update / website-upgrade)
     * since only announcement hits render the Read more toggle. */
    latestType?: string
    /** Arm of the /latest sticky filters experiment the visitor is in, if
     * assigned (`exp-latest-sticky-filters-v1` cookie). */
    experimentArm?: string
}

export interface KeyboardShortcutParams {
    /** The keyboard shortcut name */
    eventAction: KeyboardShortcutAction
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

/**
 * Every value of the `data-track-note` HTML attribute. When someone clicks an
 * element that has one, or anything inside it, we send `owid.grapher_click` if
 * the element is inside a chart and `owid.site_click` otherwise.
 */
export type TrackNote =
    // Chart: header, footer and tabs
    | "chart_click_title"
    | "chart_click_sources"
    | "chart_click_related"
    | `chart_click_${GrapherTabName}`
    // Chart: action buttons
    | "chart_click_download"
    | "chart_click_share"
    | "chart_click_fullscreen"
    | "chart_click_donate"
    | "chart_click_exploredata"
    // Chart: share menu
    | "chart_share_embed"
    | "chart_share_navigator"
    | "chart_share_copy_png"
    | "chart_share_copylink"
    // Chart: download modal
    | "chart_download_modal_tab_visualization"
    | "chart_download_modal_tab_data"
    | "chart_download_modal_vis_png"
    | "chart_download_modal_vis_svg"
    | "chart_download_click_interactive_embed"
    | "chart_download_modal_api_docs"
    | `chart_download_${"full" | "filtered"}_data--${"server" | "client"}`
    // Chart: settings
    | "chart_settings_menu_toggle"
    | "chart_toggle_scale"
    | "chart_abs_rel_toggle"
    | "chart_no_data_area_toggle"
    | "chart_zoom_to_selection"
    | "chart_facet_ydomain_toggle"
    | `chart_facet_${FacetStrategy}`
    // Chart: entities
    | "chart_add_entity"
    | "entity_selector_search"
    | "entity_picker_search_input"
    | "entity_picker_clear_selection"
    // Chart: map
    | "map_zoom_to_region"
    | "map_zoom_to_selection"
    | "map_zoom_mobile"
    | "map_reset_view"
    | "map_reset_zoom"
    // Chart: table
    | "data_table_filter_by"
    | "data_table_search"
    // Chart: timeline
    | "timeline_play"
    | "timeline_pause"
    // Explorer
    | "explorer_customize_chart_mobile"
    | ExplorerControlTrackNote
    // Multi-dimensional data page
    | "multi-dim-choice-dropdown"
    | "multi-dim-choice-toggle"
    | "multi-dim-embed-explorer-title"
    // Data page: metadata
    | "wysk_link"
    | "wysk_learn_more_in_faqs"
    | "producer_link"
    | "processing_link"
    | "data_processing_level"
    | "retrieved_from"
    | "source_link"
    // Data page: downloads
    | "datapage_download_api_docs"
    | "datapage_download_vis_link"
    | "datapage_download_data_link"
    | "datapage_download_full_data--server"
    | "datapage_download_filtered_data--server"
    // Site header, footer and floating tools
    | "header_navigation"
    | "breadcrumb"
    | "footer_navigation"
    | "footer_social"
    | "footer_social_email"
    | "donate_footer"
    | "cookie_notice"
    | "page_open_feedback"
    | "page_open_feedback_mobile_menu"
    | "page_open_jobs"
    | "dialog_open_newsletter"
    // Table of contents
    | "toc_expand"
    | "toc_collapse"
    | "toc_toggle"
    | "toc_link"
    | "toc_back_to_top"
    | "toc_see_all_charts"
    // "Follow us" links: the newsletter context they are shown in
    | "homepage"
    | "floating"
    | "homepageDataInsights"
    | "floatingDataInsights"
    | "latest"
    | "subscribePage"
    | "dataInsightsIndex"
    // Homepage
    | "featured-data-insights-see-all"
    | "featured-metrics-see-all"
    // Latest data insights, on the homepage and on data insight pages
    | LatestDataInsightsTrackNote
    | `${LatestDataInsightsTrackNote}_see_all`
    // Copy link buttons
    | "announcement_copy_link"
    | "data_insight_copy_link"
    | "latest_data_insight_copy_link"
    | "latest_data_update_copy_link"
    // Article versions
    | "gdoc-header-date-versions"
    | "gdoc-past-versions-section-open"
    // Archive
    | "archive-header-go-to-previous"
    | "archive-header-go-to-next"
    | "archive-header-go-to-live"
    | "archive-header-browse-versions"
    | "archive-timeline-version-link"
    // Search
    | "search-sources-modal"
    | "search-download-options"

/**
 * Explorer controls send `<explorer slug>_click_<control title, lowercased>`.
 * Both parts come from content, so this stays a loose pattern. As a result,
 * any value containing `_click_` compiles, including a misspelled fixed note
 * like `chart_click_sourcse`. Remove this, and its line in `TrackNote`,
 * together with `ExplorerControls.tsx`.
 */
export type ExplorerControlTrackNote = `${string}_click_${string}`

/** `<page>_<experiment arm>`, so clicks can be split by page and by arm. */
export type LatestDataInsightsTrackNote =
    `${LatestDataInsightsTrackNotePrefix}_${"carousel" | "grid"}`

export type LatestDataInsightsTrackNotePrefix =
    | "homepage_data_insights"
    | "data_insight_latest"

/** Site clicks logged from code instead of a `data-track-note` attribute. */
export type SiteClickAction =
    | "donate-now"
    | "newsletter-subscribe"
    | "cookie_preferences"
    | "related-data-charts"
    | "copy_citation"
    | "expand_metadata_box"
    | "collapse_metadata_box"
    | "expand_expandable_toggle"
    | "collapse_expandable_toggle"

/** The title of the keyboard shortcut, empty for the ones that have none. */
export type KeyboardShortcutAction =
    | ""
    | "Toggle tab"
    | "Toggle Help"
    | "Select All"
    | "Select None"
    | "Toggle Faceting"
    | "Play"
    | "Pause"
    | "Toggle Y log/linear"
    | "Toggle full-screen mode"
    | "Toggle sources modal"
    | "Toggle download modal"
    | "Latest/Earliest/All period"
    | "Reset to original"
    | "Toggle globe view"
    | "Next chart"
    | "Previous chart"

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
