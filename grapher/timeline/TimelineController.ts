import { Time } from "coreTable/CoreTableConstants"
import { TimeBound, TimeBoundValue } from "grapher/utils/TimeBounds"
import { findClosestTime, last } from "grapher/utils/Util"

export interface TimelineManager {
    disablePlay?: boolean
    formatTimeFn?: (value: any) => any
    isPlaying?: boolean
    times: Time[]
    startTime: TimeBound
    endTime: TimeBound
    msPerTick?: number
    onPlay?: () => void
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class TimelineController {
    manager: TimelineManager

    constructor(manager: TimelineManager) {
        this.manager = manager
    }

    private get timesAsc() {
        // Note: assumes times is sorted in asc
        return this.manager.times
    }

    private get startTime() {
        return findClosestTime(this.timesAsc, this.manager.startTime)!
    }

    private get endTime() {
        return findClosestTime(this.timesAsc, this.manager.endTime)!
    }

    get minTime() {
        return this.timesAsc[0]
    }

    get maxTime() {
        return last(this.timesAsc)!
    }

    get startTimeProgress() {
        return (this.startTime - this.minTime) / (this.maxTime - this.minTime)
    }

    get endTimeProgress() {
        return (this.endTime - this.minTime) / (this.maxTime - this.minTime)
    }

    snapTimes() {
        const { startTime, endTime } = this
        if (startTime === endTime) return

        if (endTime - startTime > 1) return

        // if handles within 1 time of each other, snap to closest time.
        this.manager.startTime = this.manager.endTime
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
        return this.endTime === this.maxTime
    }

    private resetToBeginning() {
        const { manager } = this
        const beginning =
            manager.endTime !== manager.startTime
                ? manager.startTime
                : this.minTime
        manager.endTime = beginning
    }

    async play(numberOfTicks?: number) {
        const { manager } = this
        manager.isPlaying = true

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
            await delay(manager.msPerTick ?? 0)
        }

        return tickCount
    }

    private stop() {
        this.manager.isPlaying = false
    }

    private pause() {
        this.manager.isPlaying = false
    }

    async togglePlay() {
        if (this.manager.isPlaying) this.pause()
        else await this.play()
    }

    private dragOffsets: [number, number] = [0, 0]

    setDragOffsets(inputTime: number) {
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        this.dragOffsets = [
            this.startTime - closestTime,
            this.endTime - closestTime,
        ]
    }

    getTimeBoundFromDrag(inputTime: Time): TimeBound {
        if (inputTime < this.minTime) return TimeBoundValue.unboundedLeft
        if (inputTime > this.maxTime) return TimeBoundValue.unboundedRight
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        return Math.min(this.maxTime, Math.max(this.minTime, closestTime))
    }

    private dragRangeToTime(time: Time) {
        const { minTime, maxTime } = this
        const closestTime = findClosestTime(this.timesAsc, time) ?? time

        let startTime = this.dragOffsets[0] + closestTime
        let endTime = this.dragOffsets[1] + closestTime

        if (startTime < minTime) {
            startTime = minTime
            endTime = this.getTimeBoundFromDrag(
                minTime + (this.dragOffsets[1] - this.dragOffsets[0])
            )
        } else if (endTime > maxTime) {
            startTime = this.getTimeBoundFromDrag(
                maxTime + (this.dragOffsets[0] - this.dragOffsets[1])
            )
            endTime = maxTime
        }

        this.updateStartTime(startTime)
        this.updateEndTime(endTime)
    }

    // TODO
    /// TODOOOOOO
    dragHandleToTime(handle: "start" | "end" | "both", inputTime: number) {
        const { manager } = this

        const time = this.getTimeBoundFromDrag(inputTime)

        const constrainedHandle =
            handle === "start" && time > this.endTime
                ? "end"
                : handle === "end" && time < this.startTime
                ? "start"
                : handle

        if (constrainedHandle !== handle) {
            if (handle === "start") this.updateStartTime(manager.endTime)
            else this.updateEndTime(manager.startTime)
        }

        if (manager.isPlaying && !this.rangeMode) {
            this.updateStartTime(time)
            this.updateEndTime(time)
        } else if (handle === "both") this.dragRangeToTime(inputTime)
        else if (constrainedHandle === "start") this.updateStartTime(time)
        else if (constrainedHandle === "end") this.updateEndTime(time)

        return constrainedHandle
    }

    private updateStartTime(timeBound: TimeBound) {
        this.manager.startTime = timeBound
    }

    private updateEndTime(timeBound: TimeBound) {
        this.manager.endTime = timeBound
    }

    resetStartToMin() {
        this.updateStartTime(TimeBoundValue.unboundedLeft)
    }

    resetEndToMax() {
        this.updateEndTime(TimeBoundValue.unboundedRight)
    }
}
