// Analytics Type System
//
// The single source of truth for the analytics events the site sends.
// Each event has exactly one params type, which says what the event is, when
// it fires, since when (`@since`), under which earlier name (`@formerly`),
// what changed along the way (`@change`), and what it carries. TypeScript
// enforces you can't send wrong parameters for an event. Events that are no
// longer sent are kept at the end of the event types, marked `@deprecated`, so
// their old rows stay explained.
//
// Read docs/analytics.md before adding or changing an event: it explains how
// an event reaches GA4, how to read these types, and what to do when an event
// changes.
//
// GA4 100-character limit:
// - GA4 truncates ALL string parameters at exactly 100 characters
// - Use separate typed parameters instead of JSON in eventContext
// - Example: searchQuery, searchTopics (separate params)
//   is better than eventContext: JSON.stringify({query, topics})

import { JsonString } from "../domainTypes/Various.js"
import { FacetStrategy, GrapherTabName } from "../grapherTypes/GrapherTypes.js"

// =============================================================================
// EVENT CATEGORIES
// =============================================================================

export enum EventCategory {
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

/**
 * Events that are no longer sent. They are left out of `EventParamsMap`, so
 * `logToGA` rejects them. Each keeps its params type, marked `@deprecated`.
 */
export enum RetiredEventCategory {
    CountryProfileSearch = "owid.country_profile_search",
    Filter = "owid.filter",
    GlobalEntitySelectorUsage = "owid.global_entity_selector_usage",
    SiteSearchClick = "owid.site_search_click",
    SiteSearchFilterClick = "owid.site_search_filter_click",
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
    [EventCategory.TranslatePage]: TranslatePageParams
}

export type GAEvent = {
    [K in EventCategory]: { event: K } & EventParamsMap[K]
}[EventCategory]

// =============================================================================
// EVENT PARAMETER INTERFACES
// =============================================================================

// Site Events

/**
 * The state of the search page: the query and the filters.
 *
 * Fires when a visitor changes the query or a filter on the search page
 * (`/search`). Each distinct state is sent once. The empty default state is
 * not sent on page load, only when the visitor comes back to it.
 * @since 2025-10
 * @formerly owid.data_catalog_search 2024-09 to 2025-10
 * @change 2025-10 The search page moved from `/data` to `/search`. Its `searchResultType` takes over from {@link SiteSearchFilterClickParams}
 * @change 2025-11 The search state is sent as separate `search…` params. Before, it was one JSON string in `eventContext`, cut at 100 characters
 * @change 2026-05 Coming back to the empty default state is sent. Before, that state was never sent
 */
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

/**
 * The state of the filters on the "Latest" page (`/latest`).
 *
 * Fires when a visitor changes the topic or content type filter on that page.
 * Each distinct state is sent once. The unfiltered default state is not sent
 * on page load, only when the visitor comes back to it.
 * @since 2026-05
 */
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
 *
 * Fires when a visitor opens an article, a data insight or a data update from
 * its card in the feed of the "Latest" page (`/latest`).
 * @since 2026-05
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

/**
 * A pick from the suggestions of the search page's own search field.
 *
 * Fires when a visitor chooses a suggested topic, country or query in the
 * autocomplete of the search page (`/search`). The search fields elsewhere on
 * the site send `owid.site_instantsearch_click` instead.
 * @since 2025-06
 */
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

/**
 * A click on a search result.
 *
 * Fires when a visitor clicks a result on the search page (`/search`): a
 * chart, an article, a topic page, a data insight, a country profile or a
 * featured visualization.
 * @since 2025-10
 * @formerly owid.data_catalog_result_click 2024-09 to 2025-10
 * @change 2025-10 Also fires for results that are not charts, and `eventContext` gains `type` and `vizType`. Takes over from {@link SiteSearchClickParams}
 */
export interface SiteSearchResultClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** JSON string with context about the clicked result */
    eventContext: string
    /** Target URL of the clicked result */
    eventTarget: string
}

/**
 * A click on a tracked element of the site that is not inside a chart.
 *
 * Fires when a visitor clicks an element that has a `data-track-note`
 * attribute (or anything inside it) and that is not inside a chart; clicks
 * inside a chart send `owid.grapher_click`. A few clicks are logged from code
 * instead, see {@link SiteClickAction}.
 * @since 2023-06
 * @formerly SiteClick 2020-03 to 2023-06
 * @change 2023-06 Every action went from kebab-case to snake_case (`header-navigation` became `header_navigation`)
 * @change 2023-06 Clicks inside a chart are sent as {@link GrapherClickParams} instead
 * @change 2023-11 Also counts clicks on elements that stop the click from reaching the page; those were missed before
 * @change 2026-07 Table of contents: `page_toggle_toc` and `toc_header` replaced by `toc_expand`, `toc_collapse`, `toc_back_to_top` and `toc_see_all_charts`
 * @change 2026-10 `gdoc-header-browse-versions` split into `gdoc-header-date-versions` and `gdoc-past-versions-section-open`
 */
export interface SiteClickParams {
    /** The clicked element's track note, or an action logged from code */
    eventAction: TrackNote | SiteClickAction
    /** Target element or label */
    eventTarget?: string
}

/**
 * A submitted newsletter or donation form.
 *
 * Fires when a visitor submits a newsletter subscription form
 * (`newsletter-subscribe`), or when the donation form was accepted and the
 * visitor is about to be sent to the payment page (`donate`).
 * @since 2024-07
 * @change 2024-11 Also fires for the donation form (`donate`). Before, only for newsletter forms
 */
export interface SiteFormSubmitParams {
    /** Action type - form submission type */
    eventAction: "newsletter-subscribe" | "donate"
    /** Target element or label */
    eventTarget?: string
}

/**
 * Use of the browser's own find-in-page.
 *
 * Fires when a visitor presses Cmd/Ctrl+F or F3 on any page, at most once per
 * page view. Find opened from the browser menu (the usual way on mobile) is
 * not seen.
 * @since 2026-10
 */
export interface SiteFindInPageParams {
    /** Always 'open': the browser's find shortcut was pressed (logged at most
     * once per page view). The browser never exposes the searched text. */
    eventAction: "open"
    /** The shortcut pressed ('mod+f' or 'f3') */
    eventContext: "mod+f" | "f3"
}

/**
 * A pick from the suggestions of a site-wide search field.
 *
 * Fires when a visitor chooses a suggestion in the autocomplete of a search
 * field outside the search page, such as the one in the site header, on the
 * homepage or on a data page.
 * @since 2024-04
 * @change 2024-04 Until 2024-04-09, `eventContext` was sent as an object instead of a JSON string
 * @change 2026-07 `eventContext` gains `source`: which search field was used
 */
export interface SiteInstantSearchClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** JSON context with query and position */
    eventContext: string
    /** Target URL */
    eventTarget: string
}

/**
 * A "page not found" page.
 *
 * Fires when a visitor lands on the site's 404 page. `eventContext` is the
 * address they tried to open.
 * @since 2023-06
 * @formerly Errors 2020-03 to 2023-06
 */
export interface SiteErrorParams {
    /** Always 'not_found' for this event */
    eventAction: "not_found"
    /** Error details or URL */
    eventContext: string
}

/**
 * A page being printed.
 *
 * Fires when a visitor prints any page of the site or opens the browser's
 * print preview.
 * @since 2026-10
 */
export interface SitePrintParams {
    /** Always 'beforeprint' for this event; fired when the browser is about to
     * print the page or open its print preview */
    eventAction: "beforeprint"
}

/**
 * A click on a guided chart link: a link in an article's text that changes
 * the view of a chart on the same page instead of opening a new page.
 *
 * Fires when a visitor clicks such a link and the chart was updated.
 * @since 2025-08
 */
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

/**
 * A chart preview shown for a link in an article.
 *
 * Fires when a visitor hovers over a link to a chart or explorer in an
 * article's text and the preview of that chart appears.
 * @since 2025-09
 */
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

/**
 * A download from a static visualization (an image-based chart in an
 * article).
 *
 * Fires when a visitor downloads the image or the data of a static
 * visualization, or clicks the link to its source.
 * @since 2026-01
 */
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

/**
 * A step in the user survey widget, which asks visitors about their role.
 *
 * Fires when the survey's question or its thank-you screen is shown to a
 * visitor, and when the visitor answers, sends feedback or dismisses the
 * widget. `responseId` links the events of one survey instance.
 * @since 2026-02
 */
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

/**
 * A chart seen by a visitor.
 *
 * Fires when a chart scrolls into view, once per chart on the page. Applies
 * to charts on their own page and to charts embedded in articles and other
 * pages. A narrative chart is logged under its parent chart's path, with
 * `narrativeChartName` set. A multi-dimensional chart fires once it has
 * become visible, and again each time the visitor switches to another view
 * (`viewConfigId` says which). Charts inside explorers send
 * `owid.explorer_view` instead.
 * @since 2024-11
 * @change 2025-01 New `chartViewName` field: a narrative chart is logged under its parent chart's path
 * @change 2025-04 Also fires for multi-dimensional charts embedded outside their own data page
 * @change 2025-05 `chartViewName` renamed to `narrativeChartName`
 * @change 2025-09 `grapherView` (JSON of the dimension choices of a multi-dimensional chart) replaced by `viewConfigId`
 * @change 2026-01 Paths over 100 characters continue in `grapherPathNext`. Before, they were cut at 100
 * @change 2026-04 A multi-dimensional chart fires only once it has become visible. Before, it also fired while still out of view
 */
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

/**
 * A click on a tracked element inside a chart.
 *
 * Fires when a visitor clicks an element that has a `data-track-note`
 * attribute (or anything inside it) inside a chart: tabs, action buttons,
 * settings, download and share options, and so on, listed in
 * {@link TrackNote}. Also fires when a visitor downloads the chart as an
 * image from the download modal (`chart_download_png`, `chart_download_svg`).
 * @since 2023-06
 * @change 2023-06 Split off from {@link SiteClickParams}. Before, clicks inside a chart were not told apart from other site clicks
 * @change 2023-10 Chart redesign: `chart_click_newtab` became `chart_click_fullscreen`; `grapher_change_entity` and `grapher_select_entities` were dropped
 * @change 2023-11 Also counts clicks on elements that stop the click from reaching the page; those were missed before
 * @change 2024-11 `chart_download_csv` replaced by `chart_download_full_data--…` and `chart_download_filtered_data--…`, each ending in `server` or `client`
 * @change 2024-11 Until 2025-01-08, both of these CSV download buttons sent `server` as the whole action, so they can't be told apart in that period
 * @change 2025-01 New `chartViewName` field for clicks inside a narrative chart
 * @change 2025-05 `chartViewName` renamed to `narrativeChartName`
 * @change 2025-05 `chart_download_png` and `chart_download_svg` are sent from code: no `eventTarget` any more, and `eventContext` is JSON with the active tab
 * @change 2025-05 `chart_filter_table_rows` replaced by `data_table_filter_by`
 * @change 2025-12 Tab clicks (`chart_click_<tab>`) were not sent from 2025-12-01 to 2025-12-03
 * @change 2026-01 Paths over 100 characters continue in `grapherPathNext`. Before, they were cut at 100
 * @change 2026-03 An image download from the download modal sends two rows: `chart_download_modal_vis_png` and `chart_download_png` (same for `svg`)
 * @change 2026-05 New `viewConfigId` field on clicks on tracked elements
 */
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

/**
 * A hover over a map.
 *
 * Fires when a visitor hovers over a country on a chart's map or globe, or
 * over an item of the map's legend.
 * @since 2025-05
 * @change 2025-09 `grapherView` (JSON of the dimension choices of a multi-dimensional chart) replaced by `viewConfigId`
 * @change 2026-01 Paths over 100 characters continue in `grapherPathNext`. Before, they were cut at 100
 */
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

/**
 * A chart that failed to display.
 *
 * Fires when a chart crashes while rendering in a visitor's browser.
 * `eventContext` is the error message. No code sends the
 * `entities_not_found` action.
 * @since 2023-06
 * @formerly GrapherErrors 2020-09 to 2023-06
 * @formerly Errors 2020-03 to 2020-09
 * @change 2023-06 Both actions went from upper case to lower case (`GRAPHER_VIEW_ERROR` became `grapher_view_error`)
 */
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

/**
 * Use of the entity selector inside a chart: the panel where a visitor picks
 * which countries or other entities the chart shows.
 *
 * Fires when a visitor selects or deselects an entity, clears the selection,
 * or changes how the list is sorted or filtered.
 * @since 2025-05
 * @change 2025-09 `grapherView` (JSON of the dimension choices of a multi-dimensional chart) replaced by `viewConfigId`
 * @change 2026-01 Paths over 100 characters continue in `grapherPathNext`. Before, they were cut at 100
 */
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

/**
 * An explorer view seen by a visitor.
 *
 * Fires when an explorer scrolls into view, and again each time the visitor
 * changes the explorer's controls to show another view.
 * @since 2024-11
 * @change 2026-01 New `viewConfigId` field
 */
export interface ExplorerViewParams {
    /** Explorer path (e.g., '/explorers/migration') */
    explorerPath: string
    /** JSON string of the explorer view state */
    explorerView: string
    /** Chart config ID of the explorer view */
    viewConfigId?: string
}

/**
 * Use of the entity picker in an explorer's sidebar.
 *
 * Fires when a visitor selects or deselects an entity there, picks one by
 * pressing Enter in its search field, or changes how the list is sorted.
 * @since 2023-06
 * @formerly <explorer>ExplorerCountrySelectorUsage 2020-09 to 2023-06
 * @formerly <explorer>DataExplorerCountrySelector 2020-05 to 2020-09
 * @change 2026-05 New `viewConfigId` field
 */
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

/**
 * A detail on demand shown: the tooltip that explains a term.
 *
 * Fires when a visitor brings up the tooltip of an underlined term, in a chart
 * or in a page's text. `eventTarget` is the id of the term.
 * @since 2024-06
 * @change 2026-09 New `eventContext` field: the region of a data page the term is in
 */
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

/**
 * An expandable section of an article being opened or closed.
 *
 * Fires when a visitor opens or closes an expander block in an article.
 * `eventTarget` is the block's title.
 * @since 2025-06
 */
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

/**
 * An announcement expanded in the feed of the "Latest" page (`/latest`).
 *
 * Fires when a visitor clicks "Read more" on an announcement card there.
 * @since 2026-05
 */
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

/**
 * A chart keyboard shortcut.
 *
 * Fires when a visitor presses one of a chart's keyboard shortcuts.
 * @since 2023-06
 * @formerly KeyboardShortcut 2020-07 to 2023-06
 * @change 2026-10 Key combinations in `eventContext` are written differently: `esc` became `Escape`, `shift+o` became `Shift+O`, `right` became `ArrowRight`
 */
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

/**
 * A page translated by the visitor's browser.
 *
 * Fires when a visitor's browser translates a page into another language, or
 * switches the translation off again.
 * @since 2025-11
 */
export interface TranslatePageParams {
    /** Information about the translation event, in the form { from: string | null, to: string | null } */
    eventTarget: JsonString
    /** Comma-separated list of browser languages, e.g.: `es-ES,de-DE,en` */
    eventContext: string
}

// =============================================================================
// RETIRED EVENTS
// =============================================================================
//
// No code sends these any more: their names are in `RetiredEventCategory` and
// they have no entry in `EventParamsMap`. The types stay so that rows sent in
// the past can still be read.

/**
 * A pick in the country search field of a country profile page.
 *
 * Fired when a visitor picked a country in the "Search for a country..." field
 * of a country profile page, which took them to that country's profile.
 * @since 2023-06
 * @formerly COVID_COUNTRY_PROFILE_SEARCH 2020-07 to 2023-06
 * @deprecated 2025-02 Search field removed. Nothing replaces it
 */
export interface CountryProfileSearchParams {
    /** Slug of the picked country */
    eventContext: string
}

/**
 * A search in the chart filter of a country page.
 *
 * Fired when a visitor typed in the field that filters the list of charts on
 * a country page.
 * @since 2023-06
 * @formerly ChartsPage 2020-03 to 2023-06
 * @change 2024-09 Action renamed from `charts_page` to `country_page_search`. Before, the filter of the charts index page sent this event too
 * @deprecated 2026-03 The code that sent it was removed. Nothing replaces it
 */
export interface FilterParams {
    /** Always 'country_page_search' for this event */
    eventAction: "country_page_search"
    /** Search query or filter context */
    eventContext: string
}

/**
 * Use of the page-wide entity selector: a control above the charts embedded
 * in a page, which set the selected countries of all of them at once.
 *
 * Fired when a visitor opened or closed that selector (`eventContext` is the
 * button's text) or changed the selection (`eventContext` is the names of the
 * selected entities, separated by commas).
 * @since 2023-06
 * @formerly GlobalEntitySelector 2021-02 to 2023-06
 * @formerly GlobalEntityControl 2020-04 to 2021-02
 * @deprecated 2026-01 Selector removed. Nothing replaces it; the closest live event is {@link GrapherEntitySelectorParams}
 */
export interface GlobalEntitySelectorUsageParams {
    /** Entity control action */
    eventAction: EntityControlEvent
    /** Additional note or context */
    eventContext?: string
}

/**
 * A click on a result of the previous search page.
 *
 * Fired when a visitor clicked a result on the search page that was at
 * `/search` until 2025-10.
 * @since 2024-04
 * @change 2024-04 Until 2024-04-09, `eventContext` was sent as an object instead of a JSON string
 * @deprecated 2025-10 Page replaced by the current search page. See {@link SiteSearchResultClickParams}
 */
export interface SiteSearchClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** JSON string with `query`, `position`, `positionInSection`,
     * `cardPosition`, `positionWithinCard` and `filter` */
    eventContext: string
    /** URL of the clicked result */
    eventTarget: string
}

/**
 * A click on a category tab of the previous search page.
 *
 * Fired when a visitor switched between the result categories on the search
 * page that was at `/search` until 2025-10.
 * @since 2024-04
 * @deprecated 2025-10 Page replaced by the current search page. See `searchResultType` in {@link SiteSearchParams}
 */
export interface SiteSearchFilterClickParams {
    /** Always 'click' for this event */
    eventAction: "click"
    /** The clicked category */
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
 * together with `ExplorerControls.tsx`, as docs/analytics.md says for a value
 * that stops being sent.
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

/** Actions of the retired page-wide entity selector. */
export type EntityControlEvent = "open" | "change" | "close"

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
