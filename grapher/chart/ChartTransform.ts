import { computed } from "mobx"
import {
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime,
} from "grapher/utils/TimeBounds"
import { first, last, sortNumeric, uniq } from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"
import { EntityDimensionKey, Time } from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"

export interface IChartTransform {
    isValidConfig: boolean
    selectableEntityDimensionKeys: EntityDimensionKey[]
    timelineTimes: Time[]
    startTime?: Time
    endTime?: Time
    targetTime?: Time
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
    abstract get availableTimes(): Time[]

    @computed get selectableEntityDimensionKeys(): EntityDimensionKey[] {
        return this.grapher.availableKeys
    }

    /**
     * A unique, sorted array of years that are possible to be selected on the timeline.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    @computed get timelineTimes(): Time[] {
        const min = this.grapher.timelineMinTime
        const max = this.grapher.timelineMaxTime
        const filteredYears = this.availableTimes.filter((time) => {
            if (min !== undefined && time < min) return false
            if (max !== undefined && time > max) return false
            return true
        })
        return sortNumeric(uniq(filteredYears))
    }

    @computed private get minTimelineTime(): Time {
        return first(this.timelineTimes) ?? 1900
    }

    @computed private get maxTimelineTime(): Time {
        return last(this.timelineTimes) ?? 2000
    }

    /**
     * The minimum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection start.
     */
    @computed get startTime(): Time {
        const min = this.grapher.timeDomain[0]
        if (isUnboundedLeft(min)) {
            return this.minTimelineTime
        } else if (isUnboundedRight(min)) {
            return this.maxTimelineTime
        }
        return getClosestTime(this.timelineTimes, min, this.minTimelineTime)
    }

    /**
     * The maximum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection end.
     */
    @computed get endTime(): Time {
        const max = this.grapher.timeDomain[1]
        if (isUnboundedLeft(max)) {
            return this.minTimelineTime
        } else if (isUnboundedRight(max)) {
            return this.maxTimelineTime
        }
        return getClosestTime(this.timelineTimes, max, this.maxTimelineTime)
    }

    @computed get hasTimeline() {
        return this.timelineTimes.length > 1 && !this.grapher.hideTimeline
    }

    /**
     * Whether the plotted data only contains a single year.
     */
    @computed get isSingleTime() {
        return this.startTime === this.endTime
    }

    /**
     * The single targetYear, if a chart is in a "single year" mode, like a LineChart becoming a
     * DiscreteBar when only a single year on the timeline is selected.
     */
    @computed get targetTime(): Time {
        return this.endTime
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
