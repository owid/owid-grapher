import { Time } from "grapher/core/GrapherConstants"
import { TimeBoundValue } from "grapher/utils/TimeBounds"
import { findClosestTime, last } from "grapher/utils/Util"

export interface TimeViz {
    isPlaying: boolean
    userHasSetTimeline: boolean
    times: Time[]
    startTime: Time
    endTime: Time
}

interface TimelineControllerOptions {
    msPerTick?: number
    onPlay?: () => void
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class TimelineController {
    private target: TimeViz
    private options: TimelineControllerOptions

    constructor(target: TimeViz, options: TimelineControllerOptions = {}) {
        this.target = target
        this.options = options
    }

    private get timesAsc() {
        // Note: assumes times is sorted in asc
        return this.target.times
    }

    get minTime() {
        return this.timesAsc[0]
    }

    get maxTime() {
        return last(this.timesAsc)!
    }

    get startTimeProgress() {
        return (
            (this.target.startTime - this.minTime) /
            (this.maxTime - this.minTime)
        )
    }

    snapTimes() {
        const { startTime, endTime } = this.target
        if (startTime === endTime) return

        if (endTime - startTime > 1) return

        // if handles within 1 time of each other, snap to closest time.
        this.target.startTime = this.target.endTime
    }

    get endTimeProgress() {
        return (
            (this.target.endTime - this.minTime) / (this.maxTime - this.minTime)
        )
    }

    getNextTime(time: number) {
        // Todo: speed up?
        return this.timesAsc[this.timesAsc.indexOf(time) + 1] ?? this.maxTime
    }

    // By default, play means extend the endTime to the right. Toggle this to play one time unit at a time.
    private rangeMode = true
    toggleRangeMode() {
        this.rangeMode = !this.rangeMode
        return this
    }

    private isAtEnd() {
        return this.target.endTime === this.maxTime
    }

    private resetToBeginning() {
        const beginning =
            this.target.endTime !== this.target.startTime
                ? this.target.startTime
                : this.minTime
        this.target.endTime = beginning
    }

    async play(numberOfTicks?: number) {
        this.target.isPlaying = true

        if (this.isAtEnd()) this.resetToBeginning()

        if (this.options.onPlay) this.options.onPlay()

        // Keep and return a tickCount for easier testability
        let tickCount = 0
        while (this.target.isPlaying) {
            const nextTime = this.getNextTime(this.target.endTime)
            if (!this.rangeMode) this.updateStartTime(nextTime)
            this.updateEndTime(nextTime)
            tickCount++
            if (nextTime >= this.maxTime || numberOfTicks === tickCount) {
                this.stop()
                break
            }
            await delay(this.options.msPerTick ?? 0)
        }

        return tickCount
    }

    private stop() {
        this.target.isPlaying = false
    }

    private pause() {
        this.target.isPlaying = false
    }

    async togglePlay() {
        if (this.target.isPlaying) this.pause()
        else await this.play()
    }

    private dragOffsets: [number, number] = [0, 0]

    setDragOffsets(inputTime: number) {
        const { target } = this
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        this.dragOffsets = [
            target.startTime - closestTime,
            target.endTime - closestTime,
        ]
    }

    getTimeFromDrag(inputTime: Time) {
        if (inputTime < this.minTime) return TimeBoundValue.unboundedLeft
        if (inputTime > this.maxTime) return TimeBoundValue.unboundedRight
        return this.getClampedTime(
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        )
    }

    private dragRangeToTime(time: Time) {
        const { minTime, maxTime } = this
        const closestTime = findClosestTime(this.timesAsc, time) ?? time

        let startTime = this.dragOffsets[0] + closestTime
        let endTime = this.dragOffsets[1] + closestTime

        if (startTime < minTime) {
            startTime = minTime
            endTime = this.getClampedTime(
                minTime + (this.dragOffsets[1] - this.dragOffsets[0])
            )
        } else if (endTime > maxTime) {
            startTime = this.getClampedTime(
                maxTime + (this.dragOffsets[0] - this.dragOffsets[1])
            )
            endTime = maxTime
        }

        this.updateStartTime(startTime)
        this.updateEndTime(endTime)
    }

    dragHandleToTime(handle: "start" | "end" | "both", inputTime: number) {
        const { target } = this

        const time = this.getTimeFromDrag(inputTime)

        const constrainedHandle =
            handle === "start" && time > target.endTime
                ? "end"
                : handle === "end" && time < target.startTime
                ? "start"
                : handle

        if (constrainedHandle !== handle) {
            if (handle === "start") this.updateStartTime(target.endTime)
            else this.updateEndTime(target.startTime)
        }

        if (target.isPlaying && !this.rangeMode) {
            this.updateStartTime(time)
            this.updateEndTime(time)
        } else if (handle === "both") this.dragRangeToTime(inputTime)
        else if (constrainedHandle === "start") this.updateStartTime(time)
        else if (constrainedHandle === "end") this.updateEndTime(time)

        return constrainedHandle
    }

    private updateStartTime(time: Time) {
        this.target.startTime = time
    }

    private updateEndTime(time: Time) {
        this.target.endTime = time
    }

    resetStartToMin() {
        this.updateStartTime(this.minTime)
    }

    resetEndToMax() {
        this.updateEndTime(this.maxTime)
    }

    private getClampedTime(inputTime: number) {
        const { minTime, maxTime } = this
        return Math.min(maxTime, Math.max(minTime, inputTime))
    }
}
