import * as _ from "lodash"

import { ChartConfigProps } from "charts/ChartConfig"
import { ChartTypeType } from "charts/ChartType"
import { EXPLORER } from "settings"

export const EXPLORABLE_CHART_TYPES: ChartTypeType[] = [
    "LineChart",
    "DiscreteBar"
]

// *****************************************************************************
// THIS IS ONLY TEMPORARY, WE SHOULD REMOVE IT ONCE THE EXPLORER FLAG IS ENABLED
// ON THE LIVE SITE.
// *****************************************************************************
//
// The live server does not yet have the checkbox to make a chart explorable, it
// is hidden behind a feature flag. So whenever we overwrite local/staging with
// the live database, we currently lose the explorer charts.
//
// In order to avoid remarking the charts, I've added some chart IDs below to be
// forced to be explorable, even if their config does not have the flag set.
//
// -@danielgavrilov 2019-12-09
export const FORCE_EXPLORABLE_CHART_IDS: number[] = [
    421,
    488,
    598,
    677,
    712,
    970,
    1068,
    1372,
    1596,
    2285
]

// A centralized predicate to test whether a chart can be explorable.
// Used for validation on both server & client.
export function canBeExplorable(config: ChartConfigProps) {
    return (
        // Only allow explorable charts if the "EXPLORER" flag in .env is true
        EXPLORER &&
        // Only allow specific chart types to be made explorable
        EXPLORABLE_CHART_TYPES.includes(config.type) &&
        // Only allow charts with a single dimension to be explorable
        config.dimensions.length === 1
    )
}

export function isExplorable(config: ChartConfigProps): boolean {
    return (
        (config.isExplorable ||
            _.includes(FORCE_EXPLORABLE_CHART_IDS, config.id)) &&
        canBeExplorable(config)
    )
}
