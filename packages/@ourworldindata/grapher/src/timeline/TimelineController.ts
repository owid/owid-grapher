import * as R from "remeda"
import { Time } from "@ourworldindata/types"
import {
    TimeBound,
    TimeBoundValue,
    sleep,
    findClosestTime,
    rollingMap,
} from "@ourworldindata/utils"
import { action, computed } from "mobx"
import { TimeColumn } from "@ourworldindata/core-table"

export enum TimelineDragTarget {
    Start = "start",
    End = "end",
    Both = "both",
}

export interface TimelineManager {
    disablePlay?: boolean
    formatTimeFn?: (time: Time) => string
    timeColumn?: TimeColumn
    isPlaying?: boolean
    isTimelineAnimationActive?: boolean
    animationStartTime?: Time
    times: Time[]
    startHandleTimeBound: TimeBound
    endHandleTimeBound: TimeBound
    areHandlesOnSameTimeBeforeAnimation?: boolean
    isSingleTimeSelectionActive?: boolean
    onlyTimeRangeSelectionPossible?: boolean
    msPerTick?: number
    onPlay?: () => void
    onTimelineClick?: () => void
    timelineDragTarget?: TimelineDragTarget
}

export class TimelineController {
    manager: TimelineManager

    constructor(manager: TimelineManager) {
        this.manager = manager
    }

    get timesAsc(): number[] {
        // Note: assumes times is sorted in asc
        return this.manager.times
    }

    get startTime(): number {
        return findClosestTime(
            this.timesAsc,
            this.manager.startHandleTimeBound
        )!
    }

    get endTime(): number {
        return findClosestTime(this.timesAsc, this.manager.endHandleTimeBound)!
    }

    get minTime(): number {
        return this.timesAsc[0]
    }

    get maxTime(): number {
        return R.last(this.timesAsc)!
    }

    get timespan(): number {
        return this.maxTime - this.minTime
    }

    /**
     * Determines whether to use equal or proportional spacing for the timeline slider.
     *
     * When using equal spacing, each time point is given equal visual space on the slider.
     * When using proportional spacing, time points are spaced based on their actual values.
     */
    @computed get shouldUseEqualSpacing(): boolean {
        // Few time points always use continuous scale
        if (this.timesAsc.length < 20) return false

        // Short timespans always use continuous scale
        if (this.timespan <= 500) return false

        // Calculate gaps between consecutive time points
        const gaps = rollingMap(this.timesAsc, (a, b) => b - a)

        const topDecileSum = R.pipe(
            gaps,
            R.takeFirstBy(gaps.length * 0.1, [R.identity(), "desc"]),
            R.sum()
        )

        return topDecileSum > this.timespan * 0.5
    }

    /**
     * Converts a time value to a normalized progress value (0-1) representing
     * its position on the timeline slider
     */
    timeToProgress(time: Time): number {
        if (this.shouldUseEqualSpacing) {
            // Equal spacing: each time point gets equal visual space
            const index = this.timesAsc.indexOf(time)
            if (index === -1) return 0
            return this.timesAsc.length > 1
                ? index / (this.timesAsc.length - 1)
                : 0
        } else {
            // Proportional spacing: linear mapping based on time value
            if (this.timespan === 0) return 0 // Handle single time point
            return (time - this.minTime) / this.timespan
        }
    }

    /**
     * Converts a normalized progress value (0-1) to the corresponding time
     * value on the timeline
     */
    progressToTime(progress: number): number {
        if (this.shouldUseEqualSpacing) {
            // Equal spacing: map progress to the nearest time index
            if (this.timesAsc.length <= 1) return this.timesAsc[0]
            const index = Math.round(progress * (this.timesAsc.length - 1))
            return this.timesAsc[
                R.clamp(index, { min: 0, max: this.timesAsc.length - 1 })
            ]
        } else {
            // Proportional spacing: linear mapping based on time value
            return this.minTime + progress * this.timespan
        }
    }

    get startTimeProgress(): number {
        return this.timeToProgress(this.startTime)
    }

    get endTimeProgress(): number {
        return this.timeToProgress(this.endTime)
    }

    // Finds the index of `time` in the `timesAsc` array.
    // Assumes the input time to be present in the array, and will throw otherwise.
    private findIndexOfTime(time: number): number {
        const index = R.sortedIndex(this.timesAsc, time)
        if (this.timesAsc[index] === time) return index
        else throw new Error(`Time ${time} not found in available times`)
    }

    getNextTime(time: number): number {
        const index = this.findIndexOfTime(time)
        return this.timesAsc[index + 1] ?? this.maxTime
    }

    getPrevTime(time: number): number {
        const index = this.findIndexOfTime(time)
        return this.timesAsc[index - 1] ?? this.minTime
    }

    getNextValidTime(time: number, avoidTime?: number): number {
        const nextTime = this.getNextTime(time)

        // If handles can't be on the same time and next time equals the avoid time,
        // don't move (return current time)
        if (
            !this.allowHandlesOnSameTime &&
            avoidTime !== undefined &&
            nextTime === avoidTime
        ) {
            return time
        }

        return nextTime
    }

    getPrevValidTime(time: number, avoidTime?: number): number {
        const prevTime = this.getPrevTime(time)

        // If handles can't be on the same time and prev time equals the avoid time,
        // don't move (return current time)
        if (
            !this.allowHandlesOnSameTime &&
            avoidTime !== undefined &&
            prevTime === avoidTime
        ) {
            return time
        }

        return prevTime
    }

    // By default, play means extend the endTime to the right. Toggle this to play one time unit at a time.
    private rangeMode = true
    toggleRangeMode(): this {
        this.rangeMode = !this.rangeMode
        return this
    }

    private isAtEnd(): boolean {
        return this.endTime === this.maxTime
    }

    private get beginning(): number {
        const { manager } = this
        return manager.endHandleTimeBound !== manager.startHandleTimeBound
            ? manager.startHandleTimeBound
            : this.minTime
    }

    @action.bound private resetToBeginning(): void {
        const { beginning } = this
        this.manager.endHandleTimeBound = beginning
        this.manager.startHandleTimeBound = beginning
    }

    @action.bound async play(numberOfTicks?: number): Promise<number> {
        const { manager } = this

        manager.isPlaying = true
        manager.isTimelineAnimationActive = true

        if (this.isAtEnd()) this.resetToBeginning()

        if (manager.onPlay) manager.onPlay()

        // Keep and return a tickCount for easier testability
        let tickCount = 0
        while (manager.isPlaying) {
            const nextTime = this.getNextTime(this.endTime)
            if (!this.rangeMode) this.updateStartTime(nextTime)
            this.updateEndTime(nextTime)
            tickCount++
            if (nextTime >= this.maxTime || numberOfTicks === tickCount) {
                this.stop()
                break
            }
            await sleep(manager.msPerTick ?? 0)
        }

        return tickCount
    }

    get allowHandlesOnSameTime(): boolean {
        return !this.manager.onlyTimeRangeSelectionPossible
    }

    increaseStartTime(): void {
        const nextTime = this.getNextTime(this.startTime)
        if (!this.allowHandlesOnSameTime && nextTime >= this.endTime) return
        this.updateStartTime(nextTime)
    }

    decreaseStartTime(): void {
        const prevTime = this.getPrevTime(this.startTime)
        this.updateStartTime(prevTime)
    }

    increaseEndTime(): void {
        const nextTime = this.getNextTime(this.endTime)
        this.updateEndTime(nextTime)
    }

    decreaseEndTime(): void {
        const prevTime = this.getPrevTime(this.endTime)
        if (!this.allowHandlesOnSameTime && prevTime <= this.startTime) return
        this.updateEndTime(prevTime)
    }

    // Jump forward by ~10% of available times
    getLargeStepForward(currentTime: number, fraction = 0.1): number {
        const currentIndex = this.findIndexOfTime(currentTime)
        if (currentIndex === -1) return this.maxTime

        const stepSize = Math.max(
            1,
            Math.floor(this.timesAsc.length * fraction)
        )

        const targetIndex = Math.min(
            this.timesAsc.length - 1,
            currentIndex + stepSize
        )

        return this.timesAsc[targetIndex]
    }

    // Jump backward by ~10% of available times
    getLargeStepBackward(currentTime: number, fraction = 0.1): number {
        const currentIndex = this.findIndexOfTime(currentTime)
        if (currentIndex === -1) return this.minTime

        const stepSize = Math.max(
            1,
            Math.floor(this.timesAsc.length * fraction)
        )

        const targetIndex = Math.max(0, currentIndex - stepSize)

        return this.timesAsc[targetIndex]
    }

    increaseStartTimeByLargeStep(): void {
        const nextTime = this.getLargeStepForward(this.startTime)
        if (!this.allowHandlesOnSameTime && nextTime >= this.endTime) {
            this.increaseStartTime()
            return
        }
        this.updateStartTime(nextTime)
    }

    decreaseStartTimeByLargeStep(): void {
        const prevTime = this.getLargeStepBackward(this.startTime)
        this.updateStartTime(prevTime)
    }

    increaseEndTimeByLargeStep(): void {
        const nextTime = this.getLargeStepForward(this.endTime)
        this.updateEndTime(nextTime)
    }

    decreaseEndTimeByLargeStep(): void {
        const prevTime = this.getLargeStepBackward(this.endTime)
        if (!this.allowHandlesOnSameTime && prevTime <= this.startTime) {
            this.decreaseEndTime()
            return
        }
        this.updateEndTime(prevTime)
    }

    @action.bound private stop(): void {
        this.manager.isPlaying = false
        this.manager.isTimelineAnimationActive = false
        this.manager.animationStartTime = undefined
        this.manager.areHandlesOnSameTimeBeforeAnimation = undefined
    }

    @action.bound private pause(): void {
        this.manager.isPlaying = false
    }

    onDrag(): void {
        this.stop()
    }

    @action.bound async togglePlay(): Promise<void> {
        if (!this.manager.isTimelineAnimationActive) {
            this.manager.areHandlesOnSameTimeBeforeAnimation =
                this.manager.startHandleTimeBound ===
                this.manager.endHandleTimeBound
            this.manager.animationStartTime = this.isAtEnd()
                ? findClosestTime(this.timesAsc, this.beginning)!
                : this.startTime
        }

        if (this.manager.isPlaying) this.pause()
        else await this.play()
    }

    private dragOffsets: [number, number] = [0, 0]

    private get isSingleDragMarker(): boolean {
        return this.dragOffsets[0] === this.dragOffsets[1]
    }

    setDragOffsets(inputTime: number): void {
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        this.dragOffsets = [
            this.startTime - closestTime,
            this.endTime - closestTime,
        ]
    }

    clampTimeBound(inputTime: Time): TimeBound {
        if (inputTime < this.minTime) return TimeBoundValue.negativeInfinity
        if (inputTime > this.maxTime) return TimeBoundValue.positiveInfinity
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        return R.clamp(closestTime, { min: this.minTime, max: this.maxTime })
    }

    private dragRangeToTime(time: Time): void {
        const { minTime, maxTime } = this

        let startTime = this.clampTimeBound(this.dragOffsets[0] + time)
        let endTime = this.clampTimeBound(this.dragOffsets[1] + time)

        if (!this.isSingleDragMarker) {
            if (startTime < minTime) {
                endTime = this.clampTimeBound(
                    minTime + (this.dragOffsets[1] - this.dragOffsets[0])
                )
            } else if (endTime > maxTime) {
                startTime = this.clampTimeBound(
                    maxTime + (this.dragOffsets[0] - this.dragOffsets[1])
                )
            }
        }

        this.updateStartTime(startTime)
        this.updateEndTime(endTime)
    }

    dragHandleToTime(
        handle: TimelineDragTarget,
        inputTime: number
    ): TimelineDragTarget {
        const { manager } = this

        let time = this.clampTimeBound(inputTime)

        // Prevent handles from being on the same time if not allowed
        if (!this.allowHandlesOnSameTime) {
            const closestTime = findClosestTime(this.timesAsc, time) ?? time
            if (
                handle === TimelineDragTarget.Start &&
                closestTime === this.endTime
            ) {
                time = this.getPrevTime(this.endTime)
            } else if (
                handle === TimelineDragTarget.End &&
                closestTime === this.startTime
            ) {
                time = this.getNextTime(this.startTime)
            }
        }

        const constrainedHandle =
            handle === TimelineDragTarget.Start && time > this.endTime
                ? TimelineDragTarget.End
                : handle === TimelineDragTarget.End && time < this.startTime
                  ? TimelineDragTarget.Start
                  : handle

        if (constrainedHandle !== handle) {
            if (handle === TimelineDragTarget.Start)
                this.updateStartTime(manager.endHandleTimeBound)
            else this.updateEndTime(manager.startHandleTimeBound)
        }

        if (manager.isPlaying && !this.rangeMode) {
            this.updateStartTime(time)
            this.updateEndTime(time)
        } else if (handle === TimelineDragTarget.Both)
            this.dragRangeToTime(inputTime)
        else if (constrainedHandle === TimelineDragTarget.Start)
            this.updateStartTime(time)
        else if (constrainedHandle === TimelineDragTarget.End)
            this.updateEndTime(time)

        return constrainedHandle
    }

    @action.bound private updateStartTime(timeBound: TimeBound): void {
        this.manager.startHandleTimeBound = timeBound
    }

    @action.bound private updateEndTime(timeBound: TimeBound): void {
        this.manager.endHandleTimeBound = timeBound
    }

    resetStartToMin(): void {
        this.updateStartTime(TimeBoundValue.negativeInfinity)
    }

    resetEndToMax(): void {
        this.updateEndTime(TimeBoundValue.positiveInfinity)
    }

    setStartToMax(): void {
        this.updateStartTime(TimeBoundValue.positiveInfinity)
    }

    setEndToMin(): void {
        this.updateEndTime(TimeBoundValue.negativeInfinity)
    }

    setStartAndEndTimeFromInput(time: number): void {
        const timeBound = this.clampTimeBound(time)
        this.updateStartTime(timeBound)
        this.updateEndTime(timeBound)
    }

    setStartTimeFromInput(time: number): void {
        let timeBound = this.clampTimeBound(time)

        // Prevent handles from being on the same time if not allowed
        const closestTime = findClosestTime(this.timesAsc, time) ?? time
        if (!this.allowHandlesOnSameTime && closestTime === this.endTime) {
            timeBound = this.getPrevTime(this.endTime)
        }

        // If new start time > current end time, swap them
        if (timeBound > this.endTime) {
            this.updateStartTime(this.manager.endHandleTimeBound)
            this.updateEndTime(timeBound)
        } else {
            this.updateStartTime(timeBound)
        }
    }

    setEndTimeFromInput(time: number): void {
        let timeBound = this.clampTimeBound(time)

        // Prevent handles from being on the same time if not allowed
        const closestTime = findClosestTime(this.timesAsc, time) ?? time
        if (!this.allowHandlesOnSameTime && closestTime === this.startTime) {
            timeBound = this.getNextTime(this.startTime)
        }

        // If new end time < current start time, swap them
        if (timeBound < this.startTime) {
            this.updateEndTime(this.manager.startHandleTimeBound)
            this.updateStartTime(timeBound)
        } else {
            this.updateEndTime(timeBound)
        }
    }
}
