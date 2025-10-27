// Analytics Event Categories and Types

export enum EventCategory {
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
}

// Event Action Types

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

// Context Interface

export interface GrapherAnalyticsContext {
    slug?: string
    viewConfigId?: string
    narrativeChartName?: string
}
