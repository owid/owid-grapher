import * as React from "react"
import { select } from "d3-selection"
import { getRelativeMouse, isMobile, debounce } from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import Tippy from "@tippyjs/react"
import classNames from "classnames"
import { TimelineController, TimeViz } from "./TimelineController"

const HANDLE_TOOLTIP_FADE_TIME_MS = 2000

export interface TimelineComponentProps {
    target: TimeViz
    disablePlay?: boolean
    formatTimeFn?: (value: any) => any
    onPlay?: () => void
    onStartPlayOrDrag?: () => void
    onStopPlayOrDrag?: () => void
}

const DEFAULT_MS_PER_TICK = 100

@observer
export class TimelineComponent extends React.Component<TimelineComponentProps> {
    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable private dragTarget?: "start" | "end" | "both"

    @computed private get isDragging(): boolean {
        return !!this.dragTarget
    }

    @computed private get subject() {
        return this.props.target
    }

    private controller = new TimelineController(this.props.target, {
        msPerTick: DEFAULT_MS_PER_TICK,
    })

    private get sliderBounds() {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null

    private getInputTimeFromMouse(event: MouseEvent) {
        const { minTime, maxTime } = this.controller
        const mouseX = getRelativeMouse(this.slider, event).x

        const fracWidth = mouseX / this.sliderBounds.width
        return minTime + fracWidth * (maxTime - minTime)
    }

    @action.bound private onDrag(inputTime: number) {
        if (!this.subject.isPlaying) this.subject.userHasSetTimeline = true
        this.dragTarget = this.controller.dragHandleToTime(
            this.dragTarget!,
            inputTime
        )
        this.showTooltips()
    }

    @action private showTooltips() {
        this.hideStartTooltip.cancel()
        this.hideEndTooltip.cancel()
        this.startTooltipVisible = true
        this.endTooltipVisible = true

        if (this.dragTarget === "start") this.lastUpdatedTooltip = "startMarker"
        if (this.dragTarget === "end") this.lastUpdatedTooltip = "endMarker"
        if (this.subject.startTime > this.subject.endTime)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === "startMarker"
                    ? "endMarker"
                    : "startMarker"
    }

    private getDragTarget(
        inputTime: number,
        isStartMarker: boolean,
        isEndMarker: boolean
    ) {
        const { startTime, endTime } = this.props.target

        if (startTime === endTime && (isStartMarker || isEndMarker))
            return "both"
        else if (isStartMarker || inputTime <= startTime) return "start"
        else if (isEndMarker || inputTime >= endTime) return "end"
        return "both"
    }

    @action.bound private onMouseDown(event: any) {
        const logic = this.controller
        const targetEl = select(event.target)

        const inputTime = this.getInputTimeFromMouse(event)

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
    @action.bound private onMouseMove(event: MouseEvent | TouchEvent) {
        const { dragTarget } = this
        if (!dragTarget) return
        if (this.queuedDrag) return

        this.queuedDrag = true
        this.onDrag(this.getInputTimeFromMouse(event as any))
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

        this.controller.snapTimes()
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
        this.controller.togglePlay()
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
    }

    private formatTime(time: number) {
        return this.props.formatTimeFn ? this.props.formatTimeFn(time) : time
    }

    private timelineEdgeMarker(markerType: "start" | "end") {
        const { controller } = this
        const time =
            markerType === "start" ? controller.minTime : controller.maxTime
        return (
            <div
                className="date clickable"
                onClick={() =>
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

    @action.bound togglePlay() {
        this.controller.togglePlay()
    }

    convertToTime(time: number) {
        if (time === -Infinity) return this.controller.minTime
        if (time === +Infinity) return this.controller.maxTime
        return time
    }

    render() {
        const { subject, controller } = this
        const { startTimeProgress, endTimeProgress } = controller
        let { startTime, endTime } = subject

        startTime = this.convertToTime(startTime)
        endTime = this.convertToTime(endTime)

        return (
            <div
                ref={this.base}
                className="TimelineComponent"
                onMouseOver={this.onMouseOver}
                onMouseLeave={this.onMouseLeave}
            >
                {!this.props.disablePlay && (
                    <div
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={this.togglePlay}
                        className="play"
                    >
                        {subject.isPlaying ? (
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
                        tooltipContent={this.formatTime(startTime)}
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
                        tooltipContent={this.formatTime(endTime)}
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
