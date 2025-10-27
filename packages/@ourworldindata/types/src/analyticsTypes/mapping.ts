// Event to Parameter Mapping
//
// Maps each EventCategory to its specific parameter interface.
// This creates the type-safe contract: each event can only be logged with
// its designated parameters.

import type { EventCategory } from "./events"
import type {
    SiteSearchParams,
    SiteSearchAutocompleteClickParams,
    SiteSearchResultClickParams,
    GrapherViewParams,
    GrapherClickParams,
    GrapherHoverParams,
    GrapherErrorParams,
    GrapherEntitySelectorParams,
    ExplorerViewParams,
    ExplorerCountrySelectorParams,
    DetailOnDemandParams,
    ExpanderParams,
    KeyboardShortcutParams,
    SiteGuidedChartLinkClickParams,
    SiteChartPreviewMouseoverParams,
    SiteClickParams,
    SiteFormSubmitParams,
    SiteInstantSearchClickParams,
    SiteErrorParams,
    FilterParams,
    GlobalEntitySelectorUsageParams,
} from "./params"

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
    [EventCategory.SiteClick]: SiteClickParams
    [EventCategory.SiteFormSubmit]: SiteFormSubmitParams
    [EventCategory.SiteInstantSearchClick]: SiteInstantSearchClickParams
    [EventCategory.SiteError]: SiteErrorParams
    [EventCategory.Filter]: FilterParams
    [EventCategory.GlobalEntitySelectorUsage]: GlobalEntitySelectorUsageParams
}

export type GAEvent = {
    [K in EventCategory]: { event: K } & EventParamsMap[K]
}[EventCategory]
