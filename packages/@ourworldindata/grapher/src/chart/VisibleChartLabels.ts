import { ChartLabelMode } from "@ourworldindata/types"

export interface VisibleChartLabels {
    /** Names in the end labels of lines, slopes, stacked areas and bars */
    endLabelNames: boolean
    /** Names labelling a row, marimekko bar or facet */
    rowLabelNames: boolean
    values: boolean
    legends: boolean
    axisText: boolean
}

const VISIBLE_LABELS_BY_MODE: Record<ChartLabelMode, VisibleChartLabels> = {
    [ChartLabelMode.All]: {
        endLabelNames: true,
        rowLabelNames: true,
        values: true,
        legends: true,
        axisText: true,
    },
    [ChartLabelMode.Values]: {
        endLabelNames: false,
        rowLabelNames: true,
        values: true,
        legends: false,
        axisText: true,
    },
    [ChartLabelMode.Names]: {
        endLabelNames: true,
        rowLabelNames: true,
        values: false,
        legends: false,
        axisText: true,
    },
    [ChartLabelMode.None]: {
        endLabelNames: false,
        rowLabelNames: false,
        values: false,
        legends: false,
        axisText: false,
    },
}

export function getVisibleLabels(
    labelMode: ChartLabelMode = ChartLabelMode.All
): VisibleChartLabels {
    return VISIBLE_LABELS_BY_MODE[labelMode]
}
