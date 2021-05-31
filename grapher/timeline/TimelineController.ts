import { Time } from "../../coreTable/CoreTableConstants"
import { TimeBound, TimeBoundValue } from "../../clientUtils/TimeBounds"
import { findClosestTime, last } from "../../clientUtils/Util"

export interface TimelineManager {
    disablePlay?: boolean
    formatTimeFn?: (time: Time) => string
    isPlaying?: boolean
    userHasSetTimeline?: boolean
    times: Time[]
    startHandleTimeBound: TimeBound
    endHandleTimeBound: TimeBound
    msPerTick?: number
    onPlay?: () => void
}

const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms))

export class TimelineController {
    manager: TimelineManager

    constructor(manager: TimelineManager) {
        this.manager = manager
    }

    private get timesAsc(): number[] {
        // Note: assumes times is sorted in asc
        return this.manager.times
    }

    private get startTime(): number {
        return findClosestTime(
            this.timesAsc,
            this.manager.startHandleTimeBound
        )!
    }

    private get endTime(): number {
        return findClosestTime(this.timesAsc, this.manager.endHandleTimeBound)!
    }

    get minTime(): number {
        return this.timesAsc[0]
    }

    get maxTime(): number {
        return last(this.timesAsc)!
    }

    get startTimeProgress(): number {
        return (this.startTime - this.minTime) / (this.maxTime - this.minTime)
    }

    get endTimeProgress(): number {
        return (this.endTime - this.minTime) / (this.maxTime - this.minTime)
    }

    getNextTime(time: number): number {
        // Todo: speed up?
        return this.timesAsc[this.timesAsc.indexOf(time) + 1] ?? this.maxTime
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

    private resetToBeginning(): void {
        const { manager } = this
        const beginning =
            manager.endHandleTimeBound !== manager.startHandleTimeBound
                ? manager.startHandleTimeBound
                : this.minTime
        manager.endHandleTimeBound = beginning
        manager.startHandleTimeBound = beginning
    }

    async play(numberOfTicks?: number): Promise<number> {
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

    private stop(): void {
        this.manager.isPlaying = false
    }

    private pause(): void {
        this.manager.isPlaying = false
    }

    async togglePlay(): Promise<void> {
        if (this.manager.isPlaying) this.pause()
        else await this.play()
    }

    private dragOffsets: [number, number] = [0, 0]

    setDragOffsets(inputTime: number): void {
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        this.dragOffsets = [
            this.startTime - closestTime,
            this.endTime - closestTime,
        ]
    }

    getTimeBoundFromDrag(inputTime: Time): TimeBound {
        if (inputTime < this.minTime) return TimeBoundValue.negativeInfinity
        if (inputTime > this.maxTime) return TimeBoundValue.positiveInfinity
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        return Math.min(this.maxTime, Math.max(this.minTime, closestTime))
    }

    private dragRangeToTime(time: Time): void {
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

    dragHandleToTime(
        handle: "start" | "end" | "both",
        inputTime: number
    ): "start" | "end" | "both" {
        const { manager } = this

        const time = this.getTimeBoundFromDrag(inputTime)

        const constrainedHandle =
            handle === "start" && time > this.endTime
                ? "end"
                : handle === "end" && time < this.startTime
                ? "start"
                : handle

        if (constrainedHandle !== handle) {
            if (handle === "start")
                this.updateStartTime(manager.endHandleTimeBound)
            else this.updateEndTime(manager.startHandleTimeBound)
        }

        if (manager.isPlaying && !this.rangeMode) {
            this.updateStartTime(time)
            this.updateEndTime(time)
        } else if (handle === "both") this.dragRangeToTime(inputTime)
        else if (constrainedHandle === "start") this.updateStartTime(time)
        else if (constrainedHandle === "end") this.updateEndTime(time)

        return constrainedHandle
    }

    private updateStartTime(timeBound: TimeBound): void {
        this.manager.startHandleTimeBound = timeBound
    }

    private updateEndTime(timeBound: TimeBound): void {
        this.manager.endHandleTimeBound = timeBound
    }

    resetStartToMin(): void {
        this.updateStartTime(TimeBoundValue.negativeInfinity)
    }

    resetEndToMax(): void {
        this.updateEndTime(TimeBoundValue.positiveInfinity)
    }
}
