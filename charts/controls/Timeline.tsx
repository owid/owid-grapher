import * as React from "react"
import { select } from "d3-selection"
import {
    first,
    last,
    findClosestYear,
    getRelativeMouse,
    isMobile
} from "charts/Util"
import { Bounds } from "charts/Bounds"
import { Analytics } from "site/client/Analytics"
import {
    observable,
    computed,
    autorun,
    action,
    runInAction,
    IReactionDisposer
} from "mobx"
import { observer } from "mobx-react"
import { ChartViewContext, ChartViewContextType } from "charts/ChartViewContext"
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

import {
    isUnbounded,
    TimeBoundValue,
    TimeBound,
    Time,
    isUnboundedLeft,
    isUnboundedRight,
    getBoundFromTimeRange
} from "charts/TimeBounds"

const DEFAULT_MIN_YEAR = 1900
const DEFAULT_MAX_YEAR = 2000

interface TimelineProps {
    years: number[]
    startYear: TimeBound
    endYear: TimeBound
    onTargetChange: ({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: TimeBound
        targetEndYear: TimeBound
    }) => void
    onStartDrag?: () => void
    onStopDrag?: () => void
    singleYearMode?: boolean
    singleYearPlay?: boolean
    disablePlay?: boolean
}

@observer
export class Timeline extends React.Component<TimelineProps> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    static contextType = ChartViewContext
    context!: ChartViewContextType

    disposers!: IReactionDisposer[]

    @observable dragTarget?: string

    @computed get isDragging(): boolean {
        return !!this.dragTarget
    }

    // Used for storing the state of the timeline.
    // They are not suitable for direct access because start can be greater than end.
    // Use `startYear` and `endYear` if the correct order of bounds is needed.
    @observable startYearRaw: TimeBound = TimeBoundValue.unboundedLeft
    @observable endYearRaw: TimeBound = TimeBoundValue.unboundedRight

    @computed get startYear(): TimeBound {
        return Math.min(this.startYearRaw, this.endYearRaw)
    }

    @computed get endYear(): TimeBound {
        return Math.max(this.startYearRaw, this.endYearRaw)
    }

    constructor(props: TimelineProps) {
        super(props)

        if (this.props.years.length === 0) {
            console.warn("invoking HTMLTimeline with empty years array")
        }
    }

    @computed get isPlaying() {
        return this.context.chart.isPlaying
    }

    componentDidUpdate() {
        const { isPlaying, isDragging } = this
        if (!isPlaying && !isDragging) {
            runInAction(() => {
                this.startYearRaw = this.props.startYear
                this.endYearRaw = this.props.endYear
                this.updateChartTimeDomain()
            })
        }
    }

    @computed get years(): Time[] {
        return this.props.years
    }

    @computed get minYear(): Time {
        return first(this.props.years) ?? DEFAULT_MIN_YEAR
    }

    @computed get maxYear(): Time {
        return last(this.props.years) ?? DEFAULT_MAX_YEAR
    }

    @computed get timeDomain(): [Time, Time] {
        return [this.minYear, this.maxYear]
    }

    getClampedYear(inputYear: Time): Time {
        const { minYear, maxYear } = this
        return Math.min(maxYear, Math.max(minYear, inputYear))
    }

    getYearUI(bound: TimeBound): Time {
        if (isUnboundedLeft(bound)) return this.minYear
        if (isUnboundedRight(bound)) return this.maxYear
        return bound
    }

    getClosest(bound: TimeBound, defaultValue: TimeBound): TimeBound {
        if (isUnbounded(bound)) return bound
        return findClosestYear(this.years, bound) ?? defaultValue
    }

    @computed get startYearUI(): Time {
        return this.getYearUI(this.startYear)
    }

    @computed get startYearClosest(): TimeBound {
        return this.getClosest(this.startYear, TimeBoundValue.unboundedLeft)
    }

    @computed get endYearUI(): Time {
        return this.getYearUI(this.endYear)
    }

    @computed get endYearClosest(): TimeBound {
        return this.getClosest(this.endYear, TimeBoundValue.unboundedRight)
    }

    animRequest?: number

    @action.bound onStartPlaying() {
        Analytics.logChartTimelinePlay(this.context.chart.props.slug)

        let lastTime: number | undefined
        const ticksPerSec = 5

        const playFrame = action((time: number) => {
            const { isPlaying, endYearUI, years, minYear, maxYear } = this
            if (!isPlaying) return

            if (lastTime === undefined) {
                // If we start playing from the end, loop around to beginning
                if (endYearUI >= maxYear) {
                    this.startYearRaw = minYear
                    this.endYearRaw = minYear
                }
            } else {
                const elapsed = time - lastTime

                if (endYearUI >= maxYear) {
                    this.context.chart.isPlaying = false
                } else {
                    const nextYear = years[years.indexOf(endYearUI) + 1]
                    const yearsToNext = nextYear - endYearUI

                    this.endYearRaw =
                        endYearUI +
                        (Math.max(yearsToNext / 3, 1) * elapsed * ticksPerSec) /
                            1000
                    if (this.props.singleYearMode || this.props.singleYearPlay)
                        this.startYearRaw = this.endYearRaw
                }
            }

            lastTime = time
            this.animRequest = requestAnimationFrame(playFrame)

            this.updateChartTimeDomain()
        })

        this.animRequest = requestAnimationFrame(playFrame)
    }

    onStopPlaying() {
        if (this.animRequest !== undefined)
            cancelAnimationFrame(this.animRequest)
    }

    get sliderBounds() {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    private slider?: Element | null

    getInputYearFromMouse(evt: MouseEvent) {
        const { minYear, maxYear } = this
        const mouseX = getRelativeMouse(this.slider, evt).x

        const fracWidth = mouseX / this.sliderBounds.width
        const inputYear = minYear + fracWidth * (maxYear - minYear)

        return inputYear
    }

    dragOffsets = [0, 0]

    @action.bound onStartYearChange(inputYear: Time) {
        this.startYearRaw = getBoundFromTimeRange(this.timeDomain, inputYear)
    }

    @action.bound onEndYearChange(inputYear: number) {
        this.endYearRaw = getBoundFromTimeRange(this.timeDomain, inputYear)
    }

    @action.bound onSingleYearChange(inputYear: number) {
        const year = getBoundFromTimeRange(this.timeDomain, inputYear)
        this.startYearRaw = year
        this.endYearRaw = year
    }

    @action.bound onRangeYearChange([startYear, endYear]: [number, number]) {
        this.startYearRaw = getBoundFromTimeRange(this.timeDomain, startYear)
        this.endYearRaw = getBoundFromTimeRange(this.timeDomain, endYear)
    }

    @action.bound onDrag(inputYear: number) {
        const { props, dragTarget, minYear, maxYear } = this
        if (!this.isPlaying) this.context.chart.userHasSetTimeline = true

        const clampedYear = this.getClampedYear(inputYear)

        if (
            props.singleYearMode ||
            (this.isPlaying && this.props.singleYearPlay)
        ) {
            this.onSingleYearChange(clampedYear)
        } else if (dragTarget === "start") {
            this.onStartYearChange(clampedYear)
        } else if (dragTarget === "end") {
            this.onEndYearChange(clampedYear)
        } else if (dragTarget === "both") {
            let startYear = this.dragOffsets[0] + inputYear
            let endYear = this.dragOffsets[1] + inputYear

            if (startYear < minYear) {
                startYear = minYear
                endYear = this.getClampedYear(
                    minYear + (this.dragOffsets[1] - this.dragOffsets[0])
                )
            } else if (endYear > maxYear) {
                startYear = this.getClampedYear(
                    maxYear + (this.dragOffsets[0] - this.dragOffsets[1])
                )
                endYear = maxYear
            }

            this.onRangeYearChange([startYear, endYear])
        }
    }

    @action.bound onMouseDown(e: any) {
        const targetEl = select(e.target)

        const { startYearUI, endYearUI } = this
        const { singleYearMode } = this.props

        const inputYear = this.getInputYearFromMouse(e)
        if (
            startYearUI === endYearUI &&
            (targetEl.classed("startMarker") || targetEl.classed("endMarker"))
        ) {
            this.dragTarget = "both"
        } else if (
            !singleYearMode &&
            (targetEl.classed("startMarker") || inputYear <= startYearUI)
        ) {
            this.dragTarget = "start"
        } else if (
            !singleYearMode &&
            (targetEl.classed("endMarker") || inputYear >= endYearUI)
        ) {
            this.dragTarget = "end"
        } else {
            this.dragTarget = "both"
        }

        if (this.dragTarget === "both") {
            this.dragOffsets = [
                this.startYearUI - inputYear,
                this.endYearUI - inputYear
            ]
        }

        this.onDrag(inputYear)

        e.preventDefault()
    }

    queuedAnimationFrame?: number

    @action.bound onMouseMove(ev: MouseEvent | TouchEvent) {
        const { dragTarget, queuedAnimationFrame } = this
        if (!dragTarget) return
        if (queuedAnimationFrame) cancelAnimationFrame(queuedAnimationFrame)

        this.queuedAnimationFrame = requestAnimationFrame(() => {
            this.onDrag(this.getInputYearFromMouse(ev as any))
        })

        this.updateChartTimeDomain()
    }

    @action.bound onMouseUp() {
        this.dragTarget = undefined

        this.updateChartTimeDomain()
    }

    @action updateChartTimeDomain() {
        if (this.props.onTargetChange) {
            this.props.onTargetChange({
                targetStartYear: this.startYearClosest,
                targetEndYear: this.endYearClosest
            })
        }
    }

    // Allow proper dragging behavior even if mouse leaves timeline area
    componentDidMount() {
        runInAction(() => {
            this.startYearRaw = this.props.startYear
            this.endYearRaw = this.props.endYear
            this.updateChartTimeDomain()
        })

        this.slider = this.base.current!.querySelector(".slider")

        document.documentElement.addEventListener("mouseup", this.onMouseUp)
        document.documentElement.addEventListener("mouseleave", this.onMouseUp)
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchend", this.onMouseUp)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)

        this.disposers = [
            autorun(() => {
                const { isPlaying } = this
                if (isPlaying) this.onStartPlaying()
                else this.onStopPlaying()
            }),
            autorun(() => {
                const { isPlaying, isDragging } = this
                const { onStartDrag, onStopDrag } = this.props
                if (isPlaying || isDragging) {
                    this.context.chart.url.debounceMode = true
                    if (onStartDrag) onStartDrag()
                } else {
                    this.context.chart.url.debounceMode = false
                    if (onStopDrag) onStopDrag()
                }
            }),
            autorun(() => {
                // If we're not playing or dragging, lock the input to the closest year (no interpolation)
                const { isPlaying, isDragging } = this
                if (!isPlaying && !isDragging) {
                    runInAction(() => {
                        // NOTE: This needs to be an atomic assignment.
                        // As start/end values can flip while dragging one handle past another, we
                        // have logic to flip start/end on the fly. But when they get reassigned, to
                        // avoid the unintentional flip, it needs to be done atomically.
                        if (this.startYearRaw > this.endYearRaw) {
                            ;[this.startYearRaw, this.endYearRaw] = [
                                this.startYearClosest,
                                this.endYearClosest
                            ]
                        }
                    })
                }
            })
        ]
    }

    componentWillUnmount() {
        document.documentElement.removeEventListener("mouseup", this.onMouseUp)
        document.documentElement.removeEventListener(
            "mouseleave",
            this.onMouseUp
        )
        document.documentElement.removeEventListener(
            "mousemove",
            this.onMouseMove
        )
        document.documentElement.removeEventListener("touchend", this.onMouseUp)
        document.documentElement.removeEventListener(
            "touchmove",
            this.onMouseMove
        )
        this.disposers.forEach(dispose => dispose())
    }

    @action.bound onTogglePlay() {
        this.context.chart.isPlaying = !this.isPlaying
    }

    @action onClickDate(dateType: "start" | "end", date: number) {
        if (dateType === "start") this.onStartYearChange(date)
        else this.onEndYearChange(date)
        this.updateChartTimeDomain()
    }

    private timelineDate(dateType: "start" | "end", date: number) {
        return (
            <div
                className="date clickable"
                onClick={() => this.onClickDate(dateType, date)}
            >
                {this.context.chart.formatYearFunction(
                    date,
                    isMobile() ? { format: "MMM D, 'YY" } : {}
                )}
            </div>
        )
    }

    render() {
        const { minYear, maxYear, isPlaying, startYearUI, endYearUI } = this

        const startYearProgress = (startYearUI - minYear) / (maxYear - minYear)
        const endYearProgress = (endYearUI - minYear) / (maxYear - minYear)

        return (
            <div ref={this.base} className={"TimelineControl"}>
                {!this.props.disablePlay && (
                    <div
                        onMouseDown={e => e.stopPropagation()}
                        onClick={this.onTogglePlay}
                        className="play"
                    >
                        {isPlaying ? (
                            <FontAwesomeIcon icon={faPause} />
                        ) : (
                            <FontAwesomeIcon icon={faPlay} />
                        )}
                    </div>
                )}
                {this.timelineDate("start", minYear)}
                <div
                    className="slider"
                    onTouchStart={this.onMouseDown}
                    onMouseDown={this.onMouseDown}
                >
                    <div
                        className="handle startMarker"
                        style={{
                            left: `${startYearProgress * 100}%`
                        }}
                    />
                    <div
                        className="interval"
                        style={{
                            left: `${startYearProgress * 100}%`,
                            right: `${100 - endYearProgress * 100}%`
                        }}
                    />
                    <div
                        className="handle endMarker"
                        style={{
                            left: `${endYearProgress * 100}%`
                        }}
                    />
                </div>
                {this.timelineDate("end", maxYear)}
            </div>
        )
    }
}
