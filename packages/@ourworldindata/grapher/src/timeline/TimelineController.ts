import { Time } from "@ourworldindata/types"
import {
    TimeBound,
    TimeBoundValue,
    delay,
    findClosestTime,
    last,
} from "@ourworldindata/utils"

export interface TimelineManager {
    disablePlay?: boolean
    formatTimeFn?: (time: Time) => string
    isPlaying?: boolean
    isTimelineAnimationActive?: boolean
    animationStartTime?: Time
    times: Time[]
    startHandleTimeBound: TimeBound
    endHandleTimeBound: TimeBound
    areHandlesOnSameTimeBeforeAnimation?: boolean
    msPerTick?: number
    onPlay?: () => void
    onTimelineClick?: () => void
}

export class TimelineController {
    manager: TimelineManager

    constructor(manager: TimelineManager) {
        this.manager = manager
    }

    private get timesAsc(): number[] {
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

    getPrevTime(time: number): number {
        return this.timesAsc[this.timesAsc.indexOf(time) - 1] ?? this.minTime
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

    private resetToBeginning(): void {
        const { beginning } = this
        this.manager.endHandleTimeBound = beginning
        this.manager.startHandleTimeBound = beginning
    }

    async play(numberOfTicks?: number): Promise<number> {
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
            await delay(manager.msPerTick ?? 0)
        }

        return tickCount
    }

    increaseStartTime(): void {
        const nextTime = this.getNextTime(this.startTime)
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
        this.updateEndTime(prevTime)
    }

    private stop(): void {
        this.manager.isPlaying = false
        this.manager.isTimelineAnimationActive = false
        this.manager.animationStartTime = undefined
        this.manager.areHandlesOnSameTimeBeforeAnimation = undefined
    }

    private pause(): void {
        this.manager.isPlaying = false
    }

    onDrag(): void {
        this.stop()
    }

    async togglePlay(): Promise<void> {
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

    getTimeBoundFromDrag(inputTime: Time): TimeBound {
        if (inputTime < this.minTime) return TimeBoundValue.negativeInfinity
        if (inputTime > this.maxTime) return TimeBoundValue.positiveInfinity
        const closestTime =
            findClosestTime(this.timesAsc, inputTime) ?? inputTime
        return Math.min(this.maxTime, Math.max(this.minTime, closestTime))
    }

    private dragRangeToTime(time: Time): void {
        const { minTime, maxTime } = this

        let startTime = this.getTimeBoundFromDrag(this.dragOffsets[0] + time)
        let endTime = this.getTimeBoundFromDrag(this.dragOffsets[1] + time)

        if (!this.isSingleDragMarker) {
            if (startTime < minTime) {
                endTime = this.getTimeBoundFromDrag(
                    minTime + (this.dragOffsets[1] - this.dragOffsets[0])
                )
            } else if (endTime > maxTime) {
                startTime = this.getTimeBoundFromDrag(
                    maxTime + (this.dragOffsets[0] - this.dragOffsets[1])
                )
            }
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

    setStartToMax(): void {
        this.updateStartTime(TimeBoundValue.positiveInfinity)
    }

    setEndToMin(): void {
        this.updateEndTime(TimeBoundValue.negativeInfinity)
    }
}
