import { computed } from "mobx"
import {
    isUnboundedLeft,
    isUnboundedRight,
    getClosestTime,
} from "grapher/utils/TimeBounds"
import { first, last, sortNumeric, uniq } from "grapher/utils/Util"
import { Grapher } from "grapher/core/Grapher"
import { Time } from "grapher/core/GrapherConstants"
import { ColorScale } from "grapher/color/ColorScale"

export interface IChartTransform {
    timelineTimes: Time[]
    startTimelineTime?: Time
    endTimelineTime?: Time
    colorScale?: ColorScale
}

export abstract class ChartTransform implements IChartTransform {
    grapher: Grapher
    constructor(grapher: Grapher) {
        this.grapher = grapher
    }

    /**
     * An array of all the years in the datapoints that can be plotted. Can contain duplicates and
     * the years may not be sorted.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    abstract get availableTimes(): Time[]

    /**
     * A unique, sorted array of years that are possible to be selected on the timeline.
     *
     * Might be **empty** if the data hasn't been loaded yet.
     */
    @computed get timelineTimes(): Time[] {
        const min = this.grapher.timelineMinTime
        const max = this.grapher.timelineMaxTime
        const filteredTimes = this.availableTimes.filter((time) => {
            if (min !== undefined && time < min) return false
            if (max !== undefined && time > max) return false
            return true
        })
        return sortNumeric(uniq(filteredTimes))
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
    @computed get startTimelineTime(): Time {
        const time = this.grapher.timeDomain[0]

        if (isUnboundedLeft(time)) return this.minTimelineTime
        else if (isUnboundedRight(time)) return this.maxTimelineTime

        return getClosestTime(this.timelineTimes, time, this.minTimelineTime)
    }

    /**
     * The maximum year that appears in the plotted data, after the raw data is filtered.
     *
     * Derived from the timeline selection end.
     */
    @computed get endTimelineTime(): Time {
        const time = this.grapher.timeDomain[1]

        if (isUnboundedLeft(time)) return this.minTimelineTime
        else if (isUnboundedRight(time)) return this.maxTimelineTime

        return getClosestTime(this.timelineTimes, time, this.maxTimelineTime)
    }

    @computed get hasTimeline() {
        return this.timelineTimes.length > 1 && !this.grapher.hideTimeline
    }

    /**
     * Whether the plotted data only contains a single year.
     */
    @computed get isSingleTime() {
        return this.startTimelineTime === this.endTimelineTime
    }
}
