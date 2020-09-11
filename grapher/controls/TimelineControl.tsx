import * as React from "react"
import { select } from "d3-selection"
import {
    last,
    findClosestYear,
    getRelativeMouse,
    isMobile,
    debounce,
} from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import { observable, computed, autorun, action, IReactionDisposer } from "mobx"
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
} from "grapher/utils/TimeBounds"
import Tippy from "@tippyjs/react"
import classNames from "classnames"

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

// The interface for the thing to be changed
interface TimelineSubject {
    isPlaying: boolean
    userHasSetTimeline: boolean
    years: number[]
    startYear: number
    endYear: number
}

export interface TimelineProps {
    subject: TimelineSubject
    singleYearMode?: boolean
    singleYearPlay?: boolean
    disablePlay?: boolean
    formatYearFn?: (value: any) => any
    onPlay?: () => void
    onStartPlayOrDrag?: () => void
    onStopPlayOrDrag?: () => void
}

@observer
export class TimelineControl extends React.Component<TimelineProps> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    private disposers!: IReactionDisposer[]

    @observable private dragTarget?: "start" | "end" | "both"

    @computed private get isDragging(): boolean {
        return !!this.dragTarget
    }

    @computed private get subject() {
        return this.props.subject
    }

    @computed private get years(): Time[] {
        return this.subject.years
    }

    @computed private get minYear(): Time {
        return this.years[0]
    }

    @computed private get maxYear(): Time {
        return last(this.years)!
    }

    @computed private get timeDomain(): [Time, Time] {
        return [this.minYear, this.maxYear]
    }

    private getClampedYear(inputYear: Time): Time {
        const { minYear, maxYear } = this
        return Math.min(maxYear, Math.max(minYear, inputYear))
    }

    private getYearUI(bound: TimeBound): Time {
        if (isUnboundedLeft(bound)) return this.minYear
        if (isUnboundedRight(bound)) return this.maxYear
        return bound
    }

    private getClosest(bound: TimeBound, defaultValue: TimeBound): TimeBound {
        if (isUnbounded(bound)) return bound
        return findClosestYear(this.years, bound) ?? defaultValue
    }

    @computed private get startYearUI() {
        return this.getYearUI(this.subject.startYear)
    }

    @computed private get startYearClosest() {
        return this.getClosest(
            this.subject.startYear,
            TimeBoundValue.unboundedLeft
        )
    }

    @computed private get endYearUI() {
        return this.getYearUI(this.subject.endYear)
    }

    @computed private get endYearClosest() {
        return this.getClosest(
            this.subject.endYear,
            TimeBoundValue.unboundedRight
        )
    }

    private animRequest?: number

    private readonly PLAY_ANIMATION_SECONDS = 45
    @action.bound private onStartPlaying() {
        const { onPlay } = this.props
        if (onPlay) onPlay()

        let lastTime: number | undefined
        const ticksPerSec = Math.max(
            this.years.length / this.PLAY_ANIMATION_SECONDS,
            2
        )

        const playFrame = action((time: number) => {
            // TODO: This method should be unit tested!
            const { endYearUI, years, minYear, maxYear, subject } = this
            if (!subject.isPlaying) return

            if (lastTime === undefined) {
                // If we start playing from the end, loop around to beginning
                if (endYearUI >= maxYear) {
                    this.subject.startYear = minYear
                    this.subject.endYear = minYear
                }
            } else {
                const elapsed = time - lastTime

                if (endYearUI >= maxYear) {
                    subject.isPlaying = false
                    this.startTooltipVisible = false
                } else {
                    const nextYear = years[years.indexOf(endYearUI) + 1]
                    const yearsToNext = nextYear - endYearUI
                    this.subject.endYear =
                        endYearUI +
                        Math.ceil(
                            (Math.max(yearsToNext / 3, 1) *
                                elapsed *
                                ticksPerSec) /
                                1000
                        )
                    if (this.props.singleYearMode || this.props.singleYearPlay)
                        this.subject.startYear = this.subject.endYear
                }
            }

            lastTime = time
            this.animRequest = requestAnimationFrame(playFrame)
        })

        this.animRequest = requestAnimationFrame(playFrame)
    }

    private onStopPlaying() {
        if (this.animRequest !== undefined)
            cancelAnimationFrame(this.animRequest)
    }

    private get sliderBounds() {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null

    private getInputYearFromMouse(evt: MouseEvent) {
        const { minYear, maxYear } = this
        const mouseX = getRelativeMouse(this.slider, evt).x

        const fracWidth = mouseX / this.sliderBounds.width
        const inputYear = minYear + fracWidth * (maxYear - minYear)

        return inputYear
    }

    private dragOffsets = [0, 0]

    @action.bound private updateStartYear(inputYear: Time) {
        this.subject.startYear = inputYear
    }

    @action.bound private updateEndYear(inputYear: number) {
        this.subject.endYear = inputYear
    }

    @action.bound private onDrag(inputYear: number) {
        const { props, dragTarget, minYear, maxYear, subject } = this
        if (!subject.isPlaying) this.subject.userHasSetTimeline = true

        const clampedYear = this.getClampedYear(inputYear)

        if (
            props.singleYearMode ||
            (subject.isPlaying && this.props.singleYearPlay)
        ) {
            this.updateStartYear(clampedYear)
            this.updateEndYear(clampedYear)
        } else if (dragTarget === "start") {
            this.updateStartYear(clampedYear)
        } else if (dragTarget === "end") {
            this.updateEndYear(clampedYear)
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

            this.updateStartYear(startYear)
            this.updateEndYear(endYear)
        }

        this.showTooltips()
    }

    @action private showTooltips() {
        this.hideStartTooltip.cancel()
        this.hideEndTooltip.cancel()
        this.startTooltipVisible = true
        this.endTooltipVisible = true

        if (this.dragTarget === "start") this.lastUpdatedTooltip = "startMarker"
        if (this.dragTarget === "end") this.lastUpdatedTooltip = "endMarker"
        if (this.subject.startYear > this.subject.endYear)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === "startMarker"
                    ? "endMarker"
                    : "startMarker"
    }

    @action.bound private onMouseDown(e: any) {
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

    private queuedDrag?: boolean
    @action.bound private onMouseMove(ev: MouseEvent | TouchEvent) {
        const { dragTarget } = this
        if (!dragTarget) return
        if (this.queuedDrag) return
        else {
            this.queuedDrag = true
            this.onDrag(this.getInputYearFromMouse(ev as any))
        }

        this.queuedDrag = false
    }

    @action.bound private onMouseUp() {
        this.dragTarget = undefined

        if (this.subject.isPlaying) return

        if (isMobile()) {
            if (this.startTooltipVisible) this.hideStartTooltip()
            if (this.endTooltipVisible) this.hideEndTooltip()
        } else if (!this.mouseHoveringOverTimeline) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }

        // if handles within 1 year of each other, snap to closest year.
        if (
            this.endYearClosestUI - this.startYearClosestUI <= 1 &&
            this.subject.startYear !== this.subject.endYear
        ) {
            this.subject.startYear = this.startYearClosest
            this.subject.endYear = this.endYearClosest
        }
    }

    private mouseHoveringOverTimeline: boolean = false
    @action.bound private onMouseOver() {
        this.mouseHoveringOverTimeline = true

        this.hideStartTooltip.cancel()
        this.startTooltipVisible = true

        this.hideEndTooltip.cancel()
        this.endTooltipVisible = true
    }

    @action.bound private onMouseLeave() {
        if (!this.subject.isPlaying && !this.isDragging) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
        this.mouseHoveringOverTimeline = false
    }

    private hideStartTooltip = debounce(() => {
        this.startTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)
    private hideEndTooltip = debounce(() => {
        this.endTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS)

    @action.bound onPlayTouchEnd(e: Event) {
        e.preventDefault()
        e.stopPropagation()
        this.onTogglePlay()
    }

    @computed private get isPlayingOrDragging() {
        return this.subject.isPlaying || this.isDragging
    }

    componentDidMount() {
        const current = this.base.current

        if (current) {
            this.slider = current.querySelector(".slider")
            this.playButton = current.querySelector(".play")
        }

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
                if (this.subject.isPlaying) this.onStartPlaying()
                else this.onStopPlaying()
            }),
            autorun(() => {
                const { onStartPlayOrDrag, onStopPlayOrDrag } = this.props
                if (this.isPlayingOrDragging) {
                    if (onStartPlayOrDrag) onStartPlayOrDrag()
                } else if (onStopPlayOrDrag) onStopPlayOrDrag()
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
        this.subject.isPlaying = !this.subject.isPlaying
        if (this.subject.isPlaying) {
            this.startTooltipVisible = true
            this.hideStartTooltip.cancel()
        }
    }

    @action private onClickDate(dateType: "start" | "end", date: number) {
        if (dateType === "start") this.updateStartYear(date)
        else this.updateEndYear(date)
    }

    private formatYear(date: number) {
        return this.props.formatYearFn ? this.props.formatYearFn(date) : date
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

    @observable private startTooltipVisible: boolean = false
    @observable private endTooltipVisible: boolean = false
    @observable private lastUpdatedTooltip?: "startMarker" | "endMarker"

    render() {
        const {
            minYear,
            maxYear,
            subject,
            startYearUI,
            endYearUI,
            startYearClosestUI,
            endYearClosestUI,
        } = this

        if (!this.years.length) return null

        const startYearProgress = (startYearUI - minYear) / (maxYear - minYear)
        const endYearProgress = (endYearUI - minYear) / (maxYear - minYear)

        return (
            <div
                ref={this.base}
                className="TimelineControl"
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.props.disablePlay && (
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={this.onTogglePlay}
                        className="play"
                    >
                        {subject.isPlaying ? (
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
