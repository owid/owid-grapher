import * as React from "react"
import { select } from "d3-selection"
import {
    first,
    last,
    findClosestYear,
    getRelativeMouse,
    isMobile,
    debounce,
} from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import {
    observable,
    computed,
    autorun,
    action,
    runInAction,
    IReactionDisposer,
} from "mobx"
import { observer } from "mobx-react"
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
    getBoundFromTimeRange,
} from "grapher/utils/TimeBounds"
import Tippy from "@tippyjs/react"
import classNames from "classnames"
import { Grapher } from "grapher/core/Grapher"

const DEFAULT_MIN_YEAR = 1900
const DEFAULT_MAX_YEAR = 2000

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

export interface TimelineProps {
    grapher: Grapher
    years: number[]
    startYear: TimeBound
    endYear: TimeBound
    onTargetChange: ({
        targetStartYear,
        targetEndYear,
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

    disposers!: IReactionDisposer[]

    @observable dragTarget?: "start" | "end" | "both"

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

    @computed get grapher() {
        return this.props.grapher
    }

    @computed get isPlaying() {
        return this.grapher.isPlaying
    }

    componentDidUpdate(prevProps: TimelineProps) {
        const { isPlaying, isDragging } = this
        const { startYear, endYear } = this.props
        if (
            !isPlaying &&
            !isDragging &&
            (prevProps.startYear != startYear || prevProps.endYear != endYear)
        ) {
            runInAction(() => {
                this.startYearRaw = this.props.startYear
                this.endYearRaw = this.props.endYear
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

    private readonly PLAY_ANIMATION_SECONDS = 45
    @action.bound onStartPlaying() {
        this.grapher.analytics.logChartTimelinePlay(this.grapher.slug)

        let lastTime: number | undefined
        const ticksPerSec = Math.max(
            this.years.length / this.PLAY_ANIMATION_SECONDS,
            2
        )

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
                    this.grapher.isPlaying = false
                    this.startTooltipVisible = false
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

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null

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
        if (!this.isPlaying) this.grapher.userHasSetTimeline = true

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

        this.updateChartTimeDomain()
        this.showTooltips()
    }

    @action showTooltips() {
        this.hideStartTooltip.cancel()
        this.hideEndTooltip.cancel()
        this.startTooltipVisible = true
        this.endTooltipVisible = true

        if (this.dragTarget === "start") this.lastUpdatedTooltip = "startMarker"
        if (this.dragTarget === "end") this.lastUpdatedTooltip = "endMarker"
        if (this.startYearRaw > this.endYearRaw)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === "startMarker"
                    ? "endMarker"
                    : "startMarker"
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
                this.endYearUI - inputYear,
            ]
        }

        this.onDrag(inputYear)

        e.preventDefault()
    }

    queuedDrag?: boolean
    @action.bound onMouseMove(ev: MouseEvent | TouchEvent) {
        const { dragTarget } = this
        if (!dragTarget) return
        if (this.queuedDrag) return
        else {
            this.queuedDrag = true
            this.onDrag(this.getInputYearFromMouse(ev as any))
        }

        this.queuedDrag = false
    }

    @action.bound onMouseUp() {
        this.dragTarget = undefined

        if (this.isPlaying) return

        if (isMobile()) {
            if (this.startTooltipVisible) this.hideStartTooltip()
            if (this.endTooltipVisible) this.hideEndTooltip()
        } else if (!this.mouseHoveringOverTimeline) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }

        // In case start handle has been dragged past end handle, make sure
        //  startYearRaw is still smallest value
        // NOTE: This needs to be an atomic assignment.
        if (this.startYearRaw > this.endYearRaw) {
            ;[this.startYearRaw, this.endYearRaw] = [
                this.startYear,
                this.endYear,
            ]
        }

        // if handles within 1 year of each other, snap to closest year.
        if (
            this.endYearClosestUI - this.startYearClosestUI <= 1 &&
            this.startYear !== this.endYear
        ) {
            ;[this.startYearRaw, this.endYearRaw] = [
                this.startYearClosest,
                this.endYearClosest,
            ]
        }
    }

    private mouseHoveringOverTimeline: boolean = false
    @action.bound onMouseOver() {
        this.mouseHoveringOverTimeline = true

        this.hideStartTooltip.cancel()
        this.startTooltipVisible = true

        this.hideEndTooltip.cancel()
        this.endTooltipVisible = true
    }

    @action.bound onMouseLeave() {
        if (!this.isPlaying && !this.isDragging) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
        this.mouseHoveringOverTimeline = false
    }

    hideStartTooltip = debounce(() => {
        this.startTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)
    hideEndTooltip = debounce(() => {
        this.endTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)

    @action updateChartTimeDomain() {
        if (this.props.onTargetChange) {
            this.props.onTargetChange({
                targetStartYear: this.startYearClosest,
                targetEndYear: this.endYearClosest,
            })
        }
    }

    @action.bound onPlayTouchEnd(e: Event) {
        e.preventDefault()
        e.stopPropagation()
        this.onTogglePlay()
    }

    // Allow proper dragging behavior even if mouse leaves timeline area
    componentDidMount() {
        runInAction(() => {
            this.startYearRaw = this.props.startYear
            this.endYearRaw = this.props.endYear
            this.updateChartTimeDomain()
        })

        this.slider = this.base.current!.querySelector(".slider")
        this.playButton = this.base.current!.querySelector(".play")

        document.documentElement.addEventListener("mouseup", this.onMouseUp)
        document.documentElement.addEventListener("mouseleave", this.onMouseUp)
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchend", this.onMouseUp)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
        this.slider?.addEventListener("touchstart", this.onMouseDown, {
            passive: false,
        })
        this.playButton?.addEventListener("touchend", this.onPlayTouchEnd, {
            passive: false,
        })

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
                    this.grapher.url.debounceMode = true
                    if (onStartDrag) onStartDrag()
                } else {
                    this.grapher.url.debounceMode = false
                    if (onStopDrag) onStopDrag()
                }
            }),
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
        this.slider?.removeEventListener("touchstart", this.onMouseDown, {
            passive: false,
        } as EventListenerOptions)
        this.playButton?.removeEventListener("touchend", this.onPlayTouchEnd, {
            passive: false,
        } as EventListenerOptions)
        this.disposers.forEach((dispose) => dispose())
    }

    @action.bound onTogglePlay() {
        this.grapher.isPlaying = !this.isPlaying
        if (this.isPlaying) {
            this.startTooltipVisible = true
            this.hideStartTooltip.cancel()
        }
    }

    @action onClickDate(dateType: "start" | "end", date: number) {
        if (dateType === "start") this.onStartYearChange(date)
        else this.onEndYearChange(date)
        this.updateChartTimeDomain()
    }

    formatYear(date: number) {
        return this.grapher.formatYearFunction(
            date,
            isMobile() ? { format: "MMM D, 'YY" } : {}
        )
    }

    private timelineDate(dateType: "start" | "end", date: number) {
        return (
            <div
                className="date clickable"
                onClick={() => this.onClickDate(dateType, date)}
            >
                {this.formatYear(date)}
            </div>
        )
    }

    @computed private get startYearClosestUI() {
        return this.getYearUI(this.startYearClosest)
    }

    @computed private get endYearClosestUI() {
        return this.getYearUI(this.endYearClosest)
    }

    @observable startTooltipVisible: boolean = false
    @observable endTooltipVisible: boolean = false
    @observable lastUpdatedTooltip?: "startMarker" | "endMarker"

    render() {
        const {
            minYear,
            maxYear,
            isPlaying,
            startYearUI,
            endYearUI,
            startYearClosestUI,
            endYearClosestUI,
        } = this

        const startYearProgress = (startYearUI - minYear) / (maxYear - minYear)
        const endYearProgress = (endYearUI - minYear) / (maxYear - minYear)

        return (
            <div
                ref={this.base}
                className={"TimelineControl"}
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.props.disablePlay && (
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
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
                    className="slider clickable"
                    onMouseDown={this.onMouseDown}
                >
                    <TimelineHandle
                        type="startMarker"
                        offsetPercent={startYearProgress * 100}
                        tooltipContent={this.formatYear(startYearClosestUI)}
                        tooltipVisible={this.startTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "startMarker" ? 2 : 1
                        }
                    />
                    <div
                        className="interval"
                        style={{
                            left: `${startYearProgress * 100}%`,
                            right: `${100 - endYearProgress * 100}%`,
                        }}
                    />
                    <TimelineHandle
                        type="endMarker"
                        offsetPercent={endYearProgress * 100}
                        tooltipContent={this.formatYear(endYearClosestUI)}
                        tooltipVisible={this.endTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "endMarker" ? 2 : 1
                        }
                    />
                </div>
                {this.timelineDate("end", maxYear)}
            </div>
        )
    }
}

const TimelineHandle = ({
    type,
    offsetPercent,
    tooltipContent,
    tooltipVisible,
    tooltipZIndex,
}: {
    type: "startMarker" | "endMarker"
    offsetPercent: number
    tooltipContent: string
    tooltipVisible: boolean
    tooltipZIndex: number
}) => {
    return (
        <div
            className={classNames("handle", type)}
            style={{
                left: `${offsetPercent}%`,
            }}
        >
            <Tippy
                content={tooltipContent}
                visible={tooltipVisible}
                zIndex={tooltipZIndex}
            >
                <div className="icon" />
            </Tippy>
        </div>
    )
}
