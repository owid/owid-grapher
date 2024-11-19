// These props of the config object are _always_ explicitly persisted
// in the chart view's config, and thus cannot be accidentally overridden by

import { GrapherInterface } from "@ourworldindata/types"

// an update to the parent chart's config.
export const CHART_VIEW_PROPS_TO_PERSIST: (keyof GrapherInterface)[] = [
    // Chart type
    "type",
    "tab",

    // Entity selection
    "selectedEntityNames",
    "selectedEntityColors",

    // Time selection
    "minTime",
    "maxTime",
]
