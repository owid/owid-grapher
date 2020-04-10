import { computed } from "mobx"

import { AxisSpec } from "./AxisSpec"
import { Colorable } from "./Colorizer"
import {
    Time,
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime
} from "./TimeBounds"
import { defaultTo, first, last } from "./Util"
import { ChartConfig } from "./ChartConfig"

export interface IChartTransform {
    isValidConfig: boolean
    yAxis?: AxisSpec
    xAxis?: AxisSpec
    selectableKeys?: string[]
    colorables?: Colorable[]
    minTimelineYear: Time
    maxTimelineYear: Time
    timelineYears: Time[]
    startYear?: Time
    endYear?: Time
    targetYear?: Time
}

export abstract class ChartTransform implements IChartTransform {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    abstract get isValidConfig(): boolean

    /**
     * A unique, sorted array of years that are possible to be selected on the timeline.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    abstract get timelineYears(): Time[]

    @computed get minTimelineYear(): Time {
        return defaultTo(first(this.timelineYears), 1900)
    }

    @computed get maxTimelineYear(): Time {
        return defaultTo(last(this.timelineYears), 2000)
    }

    /**
     * The minimum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection start.
     */
    @computed get startYear(): Time {
        const minYear = this.chart.timeDomain[0]
        if (isUnboundedLeft(minYear)) {
            return this.minTimelineYear
        } else if (isUnboundedRight(minYear)) {
            return this.maxTimelineYear
        }
        return getClosestTime(this.timelineYears, minYear, this.minTimelineYear)
    }

    /**
     * The maximum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection end.
     */
    @computed get endYear(): Time {
        const maxYear = this.chart.timeDomain[1]
        if (isUnboundedLeft(maxYear)) {
            return this.minTimelineYear
        } else if (isUnboundedRight(maxYear)) {
            return this.maxTimelineYear
        }
        return getClosestTime(this.timelineYears, maxYear, this.maxTimelineYear)
    }

    /**
     * Whether the plotted data only contains a single year.
     */
    @computed get isSingleYear(): boolean {
        return this.startYear === this.endYear
    }

    /**
     * The single targetYear, if a chart is in a "single year" mode, like a LineChart becoming a
     * DiscreteBar when only a single year on the timeline is selected.
     */
    @computed get targetYear(): Time {
        return this.endYear
    }
}
