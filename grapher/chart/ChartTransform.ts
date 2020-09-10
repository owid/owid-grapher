import { computed } from "mobx"
import {
    Time,
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime,
} from "grapher/utils/TimeBounds"
import { first, last, sortNumeric, uniq } from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"
import { EntityDimensionKey } from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"

export interface IChartTransform {
    isValidConfig: boolean
    selectableEntityDimensionKeys: EntityDimensionKey[]
    timelineYears: Time[]
    startYear?: Time
    endYear?: Time
    targetYear?: Time
    colorScale?: ColorScale
}

export abstract class ChartTransform implements IChartTransform {
    grapher: Grapher
    constructor(grapher: Grapher) {
        this.grapher = grapher
    }

    // The most common check is just "does this have a yDimension"? So make it a default, and methods and override.
    @computed get isValidConfig(): boolean {
        return this.grapher.hasYDimension
    }

    /**
     * An array of all the years in the datapoints that can be plotted. Can contain duplicates and
     * the years may not be sorted.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    abstract get availableYears(): Time[]

    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.grapher.availableKeys
    }

    /**
     * A unique, sorted array of years that are possible to be selected on the timeline.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    @computed get timelineYears(): Time[] {
        const min = this.grapher.timelineMinTime
        const max = this.grapher.timelineMaxTime
        const filteredYears = this.availableYears.filter((year) => {
            if (min !== undefined && year < min) return false
            if (max !== undefined && year > max) return false
            return true
        })
        return sortNumeric(uniq(filteredYears))
    }

    @computed private get minTimelineYear(): Time {
        return first(this.timelineYears) ?? 1900
    }

    @computed private get maxTimelineYear(): Time {
        return last(this.timelineYears) ?? 2000
    }

    /**
     * The minimum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection start.
     */
    @computed get startYear(): Time {
        const minYear = this.grapher.timeDomain[0]
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
        const maxYear = this.grapher.timeDomain[1]
        if (isUnboundedLeft(maxYear)) {
            return this.minTimelineYear
        } else if (isUnboundedRight(maxYear)) {
            return this.maxTimelineYear
        }
        return getClosestTime(this.timelineYears, maxYear, this.maxTimelineYear)
    }

    @computed get hasTimeline() {
        return this.timelineYears.length > 1 && !this.grapher.hideTimeline
    }

    /**
     * Whether the plotted data only contains a single year.
     */
    @computed get isSingleYear() {
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
        return this.grapher.stackMode === "relative"
    }

    set isRelativeMode(value: boolean) {
        this.grapher.stackMode = value ? "relative" : "absolute"
    }
}
