import React from "react"
import { select } from "d3-selection"
import {
    getRelativeMouse,
    isMobile,
    debounce,
    Bounds,
    timeFromTimebounds,
} from "@ourworldindata/utils"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import Tippy from "@tippyjs/react"
import classNames from "classnames"
import { TimelineController, TimelineManager } from "./TimelineController"

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

@observer
export class TimelineComponent extends React.Component<{
    timelineController: TimelineController
}> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable private dragTarget?: "start" | "end" | "both"

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
        this.controller.togglePlay()
    }

    @computed private get isPlayingOrDragging(): boolean {
        return this.manager.isPlaying || this.isDragging
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
            <div
                className="date clickable"
                onClick={(): void =>
                    markerType === "start"
                        ? controller.resetStartToMin()
                        : controller.resetEndToMax()
                }
            >
                {this.formatTime(time)}
            </div>
        )
    }

    @observable private startTooltipVisible: boolean = false
    @observable private endTooltipVisible: boolean = false
    @observable private lastUpdatedTooltip?: "startMarker" | "endMarker"

    @action.bound private togglePlay(): void {
        this.controller.togglePlay()
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

        const formattedStartTime = this.formatTime(
            timeFromTimebounds(startHandleTimeBound, minTime)
        )
        const formattedEndTime = this.formatTime(
            timeFromTimebounds(endHandleTimeBound, maxTime)
        )

        return (
            <div
                ref={this.base}
                className="TimelineComponent"
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.manager.disablePlay && (
                    <div
                        onMouseDown={(e): void => e.stopPropagation()}
                        onClick={this.togglePlay}
                        className="play"
                    >
                        {manager.isPlaying ? (
                            <FontAwesomeIcon icon={faPause} />
                        ) : (
                            <FontAwesomeIcon icon={faPlay} />
                        )}
                    </div>
                )}
                {this.timelineEdgeMarker("start")}
                <div
                    className="slider clickable"
                    onMouseDown={this.onMouseDown}
                >
                    <TimelineHandle
                        type="startMarker"
                        offsetPercent={startTimeProgress * 100}
                        tooltipContent={formattedStartTime}
                        tooltipVisible={this.startTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "startMarker" ? 2 : 1
                        }
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
                        offsetPercent={endTimeProgress * 100}
                        tooltipContent={formattedEndTime}
                        tooltipVisible={this.endTooltipVisible}
                        tooltipZIndex={
                            this.lastUpdatedTooltip === "endMarker" ? 2 : 1
                        }
                    />
                </div>
                {this.timelineEdgeMarker("end")}
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
}): JSX.Element => {
    return (
        <div
            className={classNames("handle", type)}
            style={{
                left: `${offsetPercent}%`,
            }}
        >
            <Tippy
                content={<span>{tooltipContent}</span>}
                visible={tooltipVisible}
                zIndex={tooltipZIndex}
            >
                <div className="icon" />
            </Tippy>
        </div>
    )
}
