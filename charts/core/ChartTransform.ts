import { computed } from "mobx"
import {
    Time,
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime
} from "charts/utils/TimeBounds"
import {
    defaultTo,
    first,
    last,
    some,
    sortNumeric,
    uniq
} from "charts/utils/Util"
import { ChartConfig } from "./ChartConfig"
import { EntityDimensionKey } from "charts/core/ChartConstants"
import { ColorScale } from "charts/color/ColorScale"

export interface IChartTransform {
    isValidConfig: boolean
    selectableEntityDimensionKeys: EntityDimensionKey[]
    minTimelineYear: Time
    maxTimelineYear: Time
    timelineYears: Time[]
    startYear?: Time
    endYear?: Time
    targetYear?: Time
    colorScale?: ColorScale
}

export abstract class ChartTransform implements IChartTransform {
    chart: ChartConfig
    constructor(chart: ChartConfig) {
        this.chart = chart
    }

    // The most common check is just "does this have a yDimension"? So make it a default, and methods and override.
    @computed get isValidConfig(): boolean {
        return this.hasYDimension
    }

    @computed protected get hasYDimension() {
        return some(this.chart.dimensions, d => d.property === "y")
    }

    /**
     * An array of all the years in the datapoints that can be plotted. Can contain duplicates and
     * the years may not be sorted.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    abstract get availableYears(): Time[]

    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.chart.availableKeys
    }

    /**
     * A unique, sorted array of years that are possible to be selected on the timeline.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    @computed get timelineYears(): Time[] {
        const min = this.chart.props.timelineMinTime
        const max = this.chart.props.timelineMaxTime
        const filteredYears = this.availableYears.filter(year => {
            if (min !== undefined && year < min) return false
            if (max !== undefined && year > max) return false
            return true
        })
        return sortNumeric(uniq(filteredYears))
    }

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

    @computed get hasTimeline(): boolean {
        return this.timelineYears.length > 1 && !this.chart.props.hideTimeline
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

    // NB: The timeline scatterplot in relative mode calculates changes relative
    // to the lower bound year rather than creating an arrow chart
    @computed get isRelativeMode(): boolean {
        return this.chart.props.stackMode === "relative"
    }

    set isRelativeMode(value: boolean) {
        this.chart.props.stackMode = value ? "relative" : "absolute"
    }
}
