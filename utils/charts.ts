import { ChartConfigProps } from "charts/core/ChartConfig"
import { ChartTypeName } from "charts/core/ChartConstants"
import { EXPLORER } from "settings"

export const EXPLORABLE_CHART_TYPES: ChartTypeName[] = [
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
// IDs extracted from the indicators spreadsheet:
// https://docs.google.com/spreadsheets/d/1jo4fJ64GtM3xBK7o3necYCsR-a4fczbxfPeGg0gia34/edit#gid=0
//
// -@danielgavrilov 2019-12-09
export const FORCE_EXPLORABLE_CHART_IDS: number[] = [
    66,
    132,
    133,
    230,
    299,
    389,
    421,
    471,
    488,
    586,
    598,
    677,
    699,
    703,
    712,
    762,
    792,
    794,
    844,
    970,
    1068,
    1372,
    1375,
    1491,
    1500,
    1546,
    1547,
    1596,
    1917,
    1965,
    1966,
    2285,
    2286,
    2469,
    2699,
    2726,
    2836,
    2837,
    2968,
    3401,
    3482,
    3485,
    3487,
    3553,
    3570,
    3594,
    3603,
    3772,
    3798,
    3799,
    3800,
    3801,
    3872,
    3873,
    3874,
    3875,
    3876
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
            (config.id !== undefined &&
                FORCE_EXPLORABLE_CHART_IDS.includes(config.id))) &&
        canBeExplorable(config)
    )
}
