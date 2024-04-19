import React from "react"
import { select } from "d3-selection"
import {
    getRelativeMouse,
    isMobile,
    debounce,
    Bounds,
    timeFromTimebounds,
    DEFAULT_BOUNDS,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { faPlay, faPause } from "@fortawesome/free-solid-svg-icons"
import classNames from "classnames"
import { TimelineController, TimelineManager } from "./TimelineController"
import { ActionButton } from "../controls/ActionButtons"
import { DEFAULT_GRAPHER_FRAME_PADDING } from "../core/GrapherConstants.js"

export const TIMELINE_HEIGHT = 32 // keep in sync with $timelineHeight in TimelineComponent.scss

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

@observer
export class TimelineComponent extends React.Component<{
    timelineController: TimelineController
    maxWidth?: number
    framePaddingHorizontal?: number
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable private dragTarget?: "start" | "end" | "both"

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_BOUNDS.width
    }

    @computed private get framePaddingHorizontal(): number {
        return (
            this.props.framePaddingHorizontal ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed private get isDragging(): boolean {
        return !!this.dragTarget
    }

    @computed private get manager(): TimelineManager {
        return this.props.timelineController.manager
    }

    @computed private get controller(): TimelineController {
        return this.props.timelineController
    }

    private get sliderBounds(): Bounds {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null

    private getInputTimeFromMouse(
        event: MouseEvent | TouchEvent
    ): number | undefined {
        const { minTime, maxTime } = this.controller
        if (!this.slider) return
        const mouseX = getRelativeMouse(this.slider, event).x

        const fracWidth = mouseX / this.sliderBounds.width
        return minTime + fracWidth * (maxTime - minTime)
    }

    @action.bound private onDrag(inputTime: number): void {
        if (!this.manager.isPlaying) this.manager.userHasSetTimeline = true
        this.dragTarget = this.controller.dragHandleToTime(
            this.dragTarget!,
            inputTime
        )
        this.showTooltips()
    }

    @action.bound private showTooltips(): void {
        this.hideStartTooltip.cancel()
        this.hideEndTooltip.cancel()
        this.startTooltipVisible = true
        this.endTooltipVisible = true

        if (this.dragTarget === "start") this.lastUpdatedTooltip = "startMarker"
        if (this.dragTarget === "end") this.lastUpdatedTooltip = "endMarker"
        if (this.manager.startHandleTimeBound > this.manager.endHandleTimeBound)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === "startMarker"
                    ? "endMarker"
                    : "startMarker"
    }

    private getDragTarget(
        inputTime: number,
        isStartMarker: boolean,
        isEndMarker: boolean
    ): "both" | "start" | "end" {
        const { startHandleTimeBound, endHandleTimeBound } = this.manager

        if (
            startHandleTimeBound === endHandleTimeBound &&
            (isStartMarker || isEndMarker)
        )
            return "both"
        else if (isStartMarker || inputTime <= startHandleTimeBound)
            return "start"
        else if (isEndMarker || inputTime >= endHandleTimeBound) return "end"
        return "both"
    }

    @action.bound private onMouseDown(event: any): void {
        const logic = this.controller
        const targetEl = select(event.target)

        const inputTime = this.getInputTimeFromMouse(event)

        if (!inputTime) return

        this.dragTarget = this.getDragTarget(
            inputTime,
            targetEl.classed("startMarker"),
            targetEl.classed("endMarker")
        )

        if (this.dragTarget === "both") logic.setDragOffsets(inputTime)

        this.onDrag(inputTime)
        event.preventDefault()
    }

    private queuedDrag?: boolean
    @action.bound private onMouseMove(event: MouseEvent | TouchEvent): void {
        const { dragTarget } = this
        if (!dragTarget) return
        if (this.queuedDrag) return

        this.queuedDrag = true
        const inputTime = this.getInputTimeFromMouse(event)
        if (inputTime) this.onDrag(inputTime)
        this.queuedDrag = false
    }

    @action.bound private onMouseUp(): void {
        this.dragTarget = undefined

        if (this.manager.isPlaying) return

        if (isMobile()) {
            if (this.startTooltipVisible) this.hideStartTooltip()
            if (this.endTooltipVisible) this.hideEndTooltip()
        } else if (!this.mouseHoveringOverTimeline) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
    }

    private mouseHoveringOverTimeline: boolean = false
    @action.bound private onMouseOver(): void {
        this.mouseHoveringOverTimeline = true

        this.hideStartTooltip.cancel()
        this.startTooltipVisible = true

        this.hideEndTooltip.cancel()
        this.endTooltipVisible = true
    }

    @action.bound private onMouseLeave(): void {
        if (!this.manager.isPlaying && !this.isDragging) {
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

    @action.bound onPlayTouchEnd(evt: Event): void {
        evt.preventDefault()
        evt.stopPropagation()
        void this.controller.togglePlay()
    }

    @computed private get isPlayingOrDragging(): boolean {
        return this.manager.isPlaying || this.isDragging
    }

    @computed private get showPlayLabel(): boolean {
        const labelWidth = Bounds.forText("Play time-lapse", {
            fontSize: 13,
        }).width
        return labelWidth < 0.1 * this.maxWidth
    }

    componentDidMount(): void {
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
    }

    componentWillUnmount(): void {
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
    }

    private formatTime(time: number): string {
        return this.manager.formatTimeFn
            ? this.manager.formatTimeFn(time)
            : time.toString()
    }

    private timelineEdgeMarker(markerType: "start" | "end"): JSX.Element {
        const { controller } = this
        const time =
            markerType === "start" ? controller.minTime : controller.maxTime
        return (
            <button
                className="date clickable"
                type="button"
                onClick={(): void =>
                    markerType === "start"
                        ? controller.resetStartToMin()
                        : controller.resetEndToMax()
                }
            >
                {this.formatTime(time)}
            </button>
        )
    }

    @observable private startTooltipVisible: boolean = false
    @observable private endTooltipVisible: boolean = false
    @observable private lastUpdatedTooltip?: "startMarker" | "endMarker"

    @action.bound private togglePlay(): void {
        void this.controller.togglePlay()
    }

    @action.bound updateStartTimeOnKeyDown(key: string): void {
        const { controller } = this
        if (key === "Home") {
            controller.resetStartToMin()
        } else if (key === "End") {
            controller.setStartToMax()
        } else if (key === "ArrowLeft" || key === "ArrowDown") {
            controller.decreaseStartTime()
        } else if (key === "ArrowRight" || key === "ArrowUp") {
            controller.increaseStartTime()
        }
    }

    @action.bound updateEndTimeOnKeyDown(key: string): void {
        const { controller } = this
        if (key === "Home") {
            controller.setEndToMin()
        } else if (key === "End") {
            controller.resetEndToMax()
        } else if (key === "ArrowLeft" || key === "ArrowDown") {
            controller.decreaseEndTime()
        } else if (key === "ArrowRight" || key === "ArrowUp") {
            controller.increaseEndTime()
        }
    }

    convertToTime(time: number): number {
        if (time === -Infinity) return this.controller.minTime
        if (time === +Infinity) return this.controller.maxTime
        return time
    }

    render(): JSX.Element {
        const { manager, controller } = this
        const { startTimeProgress, endTimeProgress, minTime, maxTime } =
            controller
        const { startHandleTimeBound, endHandleTimeBound } = manager

        const formattedMinTime = this.formatTime(minTime)
        const formattedMaxTime = this.formatTime(maxTime)
        const formattedStartTime = this.formatTime(
            timeFromTimebounds(startHandleTimeBound, minTime, maxTime)
        )
        const formattedEndTime = this.formatTime(
            timeFromTimebounds(endHandleTimeBound, minTime, maxTime)
        )

        return (
            <div
                ref={this.base}
                className={
                    "TimelineComponent" +
                    (this.mouseHoveringOverTimeline ? " hover" : "")
                }
                style={{
                    padding: `0 ${this.framePaddingHorizontal}px`,
                }}
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.manager.disablePlay && (
                    <ActionButton
                        dataTrackNote={
                            manager.isPlaying
                                ? "timeline_pause"
                                : "timeline_play"
                        }
                        onMouseDown={(e): void => e.stopPropagation()}
                        onClick={this.togglePlay}
                        showLabel={this.showPlayLabel}
                        label={
                            (manager.isPlaying ? "Pause" : "Play") +
                            " time-lapse"
                        }
                        icon={manager.isPlaying ? faPause : faPlay}
                        isActive={manager.isPlaying}
                        style={{ minWidth: TIMELINE_HEIGHT }}
                    />
                )}
                {this.timelineEdgeMarker("start")}
                <div
                    className="slider clickable"
                    onMouseDown={this.onMouseDown}
                >
                    <TimelineHandle
                        type="startMarker"
                        label="Start time"
                        offsetPercent={startTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedStartTime}
                        tooltipVisible={this.startTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "startMarker" ? 2 : 1
                        }
                        onKeyDown={action((e) => {
                            // prevent browser to scroll to the top or bottom of the page
                            if (e.key === "Home" || e.key === "End")
                                e.preventDefault()

                            this.updateStartTimeOnKeyDown(e.key)
                        })}
                        onFocus={action(() => {
                            this.showTooltips()
                        })}
                        onBlur={action(() => {
                            this.startTooltipVisible = false
                            this.endTooltipVisible = false
                        })}
                    />
                    <div
                        className="interval"
                        style={{
                            left: `${startTimeProgress * 100}%`,
                            right: `${100 - endTimeProgress * 100}%`,
                        }}
                    />
                    <TimelineHandle
                        type="endMarker"
                        label="End time"
                        offsetPercent={endTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedEndTime}
                        tooltipVisible={this.endTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "endMarker" ? 2 : 1
                        }
                        onKeyDown={action((e) => {
                            // prevent browser to scroll to the top or bottom of the page
                            if (e.key === "Home" || e.key === "End")
                                e.preventDefault()

                            this.updateEndTimeOnKeyDown(e.key)
                        })}
                        onFocus={action(() => {
                            this.showTooltips()
                        })}
                        onBlur={action(() => {
                            this.startTooltipVisible = false
                            this.endTooltipVisible = false
                        })}
                    />
                </div>
                {this.timelineEdgeMarker("end")}
            </div>
        )
    }
}

const TimelineHandle = ({
    type,
    label,
    offsetPercent,
    formattedMinTime,
    formattedMaxTime,
    formattedCurrTime,
    tooltipVisible,
    tooltipZIndex,
    onKeyDown,
    onFocus,
    onBlur,
}: {
    type: "startMarker" | "endMarker"
    label: string
    offsetPercent: number
    formattedMinTime: string
    formattedMaxTime: string
    formattedCurrTime: string
    tooltipVisible: boolean
    tooltipZIndex: number
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
    onFocus?: React.FocusEventHandler<HTMLDivElement>
    onBlur?: React.FocusEventHandler<HTMLDivElement>
}): JSX.Element => {
    return (
        // @ts-expect-error aria-value* fields expect a number, but if we're dealing with daily data,
        // the numeric representation of a date is meaningless, so we pass the formatted date string instead.
        <div
            className={classNames("handle", type)}
            style={{
                left: `${offsetPercent}%`,
            }}
            role="slider"
            tabIndex={0}
            aria-valuemin={castToNumberIfPossible(formattedMinTime)}
            aria-valuenow={castToNumberIfPossible(formattedCurrTime)}
            aria-valuemax={castToNumberIfPossible(formattedMaxTime)}
            aria-label={label}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
        >
            <div className="icon" />
            {tooltipVisible && (
                <>
                    <div
                        className="handle-label-arrow"
                        style={{ zIndex: tooltipZIndex }}
                    />
                    <div
                        className="handle-label"
                        style={{ zIndex: tooltipZIndex }}
                    >
                        {formattedCurrTime}
                    </div>
                </>
            )}
        </div>
    )
}

function castToNumberIfPossible(s: string): string | number {
    return isNumber(s) ? +s : s
}

function isNumber(s: string): boolean {
    return /^\d+$/.test(s)
}
