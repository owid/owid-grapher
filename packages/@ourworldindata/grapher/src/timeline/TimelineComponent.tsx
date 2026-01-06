import * as _ from "lodash-es"
import * as React from "react"
import { select } from "d3-selection"
import cx from "classnames"
import { match } from "ts-pattern"
import {
    getRelativeMouse,
    Bounds,
    Time,
    parseIntOrUndefined,
    isTouchDevice,
    convertDaysSinceEpochToDate,
    diffDateISOStringInDays,
    EPOCH_DATE,
} from "@ourworldindata/utils"
import { observable, computed, action, makeObservable, reaction } from "mobx"
import { ColumnTypeMap } from "@ourworldindata/core-table"
import { observer } from "mobx-react"
import { faPlay, faPause } from "@fortawesome/free-solid-svg-icons"
import {
    TimelineController,
    TimelineManager,
    TimelineDragTarget,
} from "./TimelineController"
import { ActionButton } from "../controls/ActionButtons"
import {
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    GRAPHER_TIMELINE_CLASS,
} from "../core/GrapherConstants.js"
import { DateField, DateInput, DateSegment } from "react-aria-components"
import { CalendarDate } from "@internationalized/date"

export const TIMELINE_HEIGHT = 32 // Keep in sync with $timelineHeight in TimelineComponent.scss

const HANDLE_DIAMETER = 20 // Keep in sync with $handle-diameter in TimelineComponent.scss
const HANDLE_TOOLTIP_FADE_TIME_MS_MOBILE = 1000 // Brief delay after drag on mobile

const SLIDER_CLASS = "GrapherTimeline__Slider"
const PLAY_BUTTON_CLASS = "GrapherTimeline__PlayButton"

enum MarkerType {
    Start = "startMarker",
    End = "endMarker",
    Hover = "hoverMarker",
}

const NAVIGATION_KEYS = [
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "PageUp",
    "PageDown",
    "Home",
    "End",
] as const

type NavigationKey = (typeof NAVIGATION_KEYS)[number]

interface TimelineComponentProps {
    timelineController: TimelineController
    maxWidth?: number
}

@observer
export class TimelineComponent extends React.Component<TimelineComponentProps> {
    base = React.createRef<HTMLDivElement>()

    private hoverTime?: Time

    private startTooltipVisible: boolean = false
    private endTooltipVisible: boolean = false
    private lastUpdatedTooltip?: MarkerType

    private editHandle?: Exclude<MarkerType, MarkerType.Hover>

    private slider?: Element | HTMLElement | null
    private playButton?: Element | HTMLElement | null
    private disposers: (() => void)[] = []

    constructor(props: TimelineComponentProps) {
        super(props)

        makeObservable<
            TimelineComponent,
            | "startTooltipVisible"
            | "endTooltipVisible"
            | "lastUpdatedTooltip"
            | "hoverTime"
            | "editHandle"
        >(this, {
            startTooltipVisible: observable,
            endTooltipVisible: observable,
            lastUpdatedTooltip: observable,
            hoverTime: observable,
            editHandle: observable,
        })
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? DEFAULT_GRAPHER_BOUNDS.width
    }

    @computed private get dragTarget(): TimelineDragTarget | undefined {
        return this.manager.timelineDragTarget
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

    @computed private get isTouchDevice(): boolean {
        return isTouchDevice()
    }

    @computed private get canEditTimeViaTooltip(): boolean {
        return !this.isTouchDevice
    }

    @computed private get isDailyData(): boolean {
        const { timeColumn } = this.manager
        return (
            timeColumn !== undefined && timeColumn instanceof ColumnTypeMap.Day
        )
    }

    private get sliderBounds(): Bounds {
        return this.slider
            ? Bounds.fromRect(this.slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

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
        this.controller.onDrag()
        this.manager.timelineDragTarget = this.controller.dragHandleToTime(
            this.dragTarget!,
            inputTime
        )
        this.showTooltips()
    }

    @action.bound private showStartTooltip(): void {
        this.hideStartTooltipWithDelay.cancel()
        this.startTooltipVisible = true
    }

    @action.bound private showEndTooltip(): void {
        this.hideEndTooltipWithDelay.cancel()
        this.endTooltipVisible = true
    }

    @action.bound private showTooltips(): void {
        this.showStartTooltip()
        this.showEndTooltip()

        if (this.dragTarget === "start")
            this.lastUpdatedTooltip = MarkerType.Start
        if (this.dragTarget === "end") this.lastUpdatedTooltip = MarkerType.End
        if (this.manager.startHandleTimeBound > this.manager.endHandleTimeBound)
            this.lastUpdatedTooltip =
                this.lastUpdatedTooltip === MarkerType.Start
                    ? MarkerType.End
                    : MarkerType.Start
    }

    private getDragTarget(
        inputTime: number,
        isStartMarker: boolean,
        isEndMarker: boolean
    ): TimelineDragTarget {
        const { startHandleTimeBound, endHandleTimeBound } = this.manager

        if (
            startHandleTimeBound === endHandleTimeBound &&
            (isStartMarker || isEndMarker)
        )
            return TimelineDragTarget.Both
        else if (isStartMarker || inputTime <= startHandleTimeBound)
            return TimelineDragTarget.Start
        else if (isEndMarker || inputTime >= endHandleTimeBound)
            return TimelineDragTarget.End
        return TimelineDragTarget.Both
    }

    @action.bound private onMouseDown(event: MouseEvent | TouchEvent): void {
        // Exit edit mode if dragging starts
        this.resetEditState()

        this.manager.onTimelineClick?.()

        // Immediately hide the hover time handle
        this.hoverTime = undefined

        const targetEl = select(event.target as Element)

        const inputTime = this.getInputTimeFromMouse(event)
        if (inputTime === undefined) return

        this.manager.timelineDragTarget = this.getDragTarget(
            inputTime,
            targetEl.classed(MarkerType.Start),
            targetEl.classed(MarkerType.End)
        )

        if (this.dragTarget === "both")
            this.controller.setDragOffsets(inputTime)

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
        if (inputTime !== undefined) this.onDrag(inputTime)
        this.queuedDrag = false
    }

    @action.bound private onMouseUp(): void {
        this.manager.timelineDragTarget = undefined

        if (this.manager.isPlaying) return

        this.hideTooltipsAfterInteraction()
    }

    @computed private get areBothHandlesVisible(): boolean {
        return this.controller.startTime !== this.controller.endTime
    }

    @computed private get shouldShowHoverTimeHandle(): boolean {
        return (
            !this.manager.isSingleTimeSelectionActive &&
            !this.isDragging &&
            !this.areBothHandlesVisible &&
            !this.editHandle
        )
    }

    private setHoverTime(event: MouseEvent | TouchEvent): void {
        if (!this.shouldShowHoverTimeHandle) return

        const inputTime = this.getInputTimeFromMouse(event)
        if (inputTime === undefined) return

        if (!this.slider) return
        const mouseX = getRelativeMouse(this.slider, event).x
        const startX =
            this.controller.startTimeProgress * this.slider.clientWidth

        // Hide the hover handle when the mouse is positioned directly over
        // the existing time handle
        if (Math.abs(mouseX - startX) < HANDLE_DIAMETER) {
            this.hoverTime = undefined
            return
        }

        const timeBound = this.controller.clampTimeBound(inputTime)
        if (!Number.isFinite(timeBound)) return

        this.hoverTime = timeBound
    }

    @computed private get hoverTimeProgress(): number | undefined {
        if (this.hoverTime === undefined) return undefined
        return this.controller.calculateProgress(this.hoverTime)
    }

    private mouseHoveringOverTimeline: boolean = false
    @action.bound private onMouseOverSlider(event: MouseEvent): void {
        this.mouseHoveringOverTimeline = true

        this.showStartTooltip()
        this.showEndTooltip()

        this.setHoverTime(event)
    }

    @action.bound private onMouseMoveSlider(event: MouseEvent): void {
        this.setHoverTime(event)
    }

    @action.bound private onMouseLeaveSlider(): void {
        if (!this.manager.isPlaying && !this.isDragging && !this.editHandle) {
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
        this.mouseHoveringOverTimeline = false
        this.hoverTime = undefined
        // Don't reset edit state when mouse leaves - let user complete editing
        if (!this.editHandle) this.resetEditState()
    }

    private hideStartTooltipWithDelay = _.debounce(() => {
        this.startTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS_MOBILE)
    private hideEndTooltipWithDelay = _.debounce(() => {
        this.endTooltipVisible = false
    }, HANDLE_TOOLTIP_FADE_TIME_MS_MOBILE)

    @action.bound private hideTooltipsAfterInteraction(): void {
        if (this.isTouchDevice) {
            // On mobile, hide after a brief delay so user can see final values
            this.hideStartTooltipWithDelay()
            this.hideEndTooltipWithDelay()
        } else if (!this.mouseHoveringOverTimeline) {
            // On desktop, hide immediately if not hovering
            this.startTooltipVisible = false
            this.endTooltipVisible = false
        }
    }

    @action.bound private onPlayTouchEnd(evt: Event): void {
        evt.preventDefault()
        evt.stopPropagation()

        // Show tooltips when starting playback
        if (!this.manager.isPlaying) {
            this.showStartTooltip()
            this.showEndTooltip()
        }

        void this.controller.togglePlay()
    }

    @action.bound private onSliderTouchStart(event: Event): void {
        this.onMouseDown(event as TouchEvent)
    }

    @computed private get showPlayLabel(): boolean {
        const labelWidth = Bounds.forText("Play time-lapse", {
            fontSize: 13,
        }).width
        return labelWidth < 0.1 * this.maxWidth
    }

    override componentDidMount(): void {
        const current = this.base.current

        if (current) {
            this.slider = current.querySelector(`.${SLIDER_CLASS}`)
            this.playButton = current.querySelector(`.${PLAY_BUTTON_CLASS}`)
        }

        document.documentElement.addEventListener("mouseup", this.onMouseUp)
        document.documentElement.addEventListener("mouseleave", this.onMouseUp)
        document.documentElement.addEventListener("mousemove", this.onMouseMove)
        document.documentElement.addEventListener("touchend", this.onMouseUp)
        document.documentElement.addEventListener("touchmove", this.onMouseMove)
        this.slider?.addEventListener("touchstart", this.onSliderTouchStart, {
            passive: false,
        })
        this.playButton?.addEventListener("touchend", this.onPlayTouchEnd, {
            passive: false,
        })

        // Hide tooltips when playback stops
        this.disposers.push(
            reaction(
                () => this.manager.isPlaying,
                (isPlaying, wasPlaying) => {
                    if (wasPlaying && !isPlaying)
                        this.hideTooltipsAfterInteraction()
                }
            )
        )
    }

    override componentWillUnmount(): void {
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
        this.slider?.removeEventListener("touchstart", this.onSliderTouchStart)
        this.playButton?.removeEventListener("touchend", this.onPlayTouchEnd)

        this.disposers.forEach((dispose) => dispose())
    }

    private formatTime(time: number): string {
        return this.manager.formatTimeFn
            ? this.manager.formatTimeFn(time)
            : time.toString()
    }

    @action.bound private togglePlay(): void {
        void this.controller.togglePlay()
    }

    @action.bound private onStartEditing(
        handle: Exclude<MarkerType, MarkerType.Hover>
    ): void {
        this.editHandle = handle
    }

    @action.bound private resetEditState(): void {
        this.editHandle = undefined
    }

    @action.bound private onCompleteYear(year?: number): void {
        // Only apply when the user has finished typing
        if (year !== undefined && this.editHandle !== undefined)
            this.onChangeYear(year)
        this.resetEditState()
    }

    @action.bound private onChangeYear(year: number): void {
        if (!this.areBothHandlesVisible) {
            this.controller.setStartAndEndTimeFromInput(year)
        } else if (this.editHandle === MarkerType.Start) {
            this.controller.setStartTimeFromInput(year)
        } else {
            this.controller.setEndTimeFromInput(year)
        }
    }

    @action.bound private onCompleteDate(date?: CalendarDate): void {
        // Only apply when the user has finished typing
        if (date && this.editHandle !== undefined) this.onChangeDate(date)
        this.resetEditState()
    }

    @action.bound private onChangeDate(date: CalendarDate): void {
        const daysSinceEpoch = calendarDateToDaysSinceEpoch(date)
        if (!this.areBothHandlesVisible) {
            this.controller.setStartAndEndTimeFromInput(daysSinceEpoch)
        } else if (this.editHandle === MarkerType.Start) {
            this.controller.setStartTimeFromInput(daysSinceEpoch)
        } else {
            this.controller.setEndTimeFromInput(daysSinceEpoch)
        }
    }

    @action.bound private getStartTimeForNavigationKey(
        key: NavigationKey
    ): number {
        const { controller } = this
        const { startTime, endTime } = controller

        return match(key)
            .with("ArrowUp", "ArrowRight", () =>
                controller.getNextValidTime(startTime, endTime)
            )
            .with("ArrowDown", "ArrowLeft", () =>
                controller.getPrevValidTime(startTime, endTime)
            )
            .with("PageUp", () => controller.getLargeStepForward(startTime))
            .with("PageDown", () => controller.getLargeStepBackward(startTime))
            .with("Home", () => controller.minTime)
            .with("End", () => controller.maxTime)
            .exhaustive()
    }

    @action.bound private getEndTimeForNavigationKey(
        key: NavigationKey
    ): number {
        const { controller } = this
        const { startTime, endTime } = controller

        return match(key)
            .with("ArrowUp", "ArrowRight", () =>
                controller.getNextValidTime(endTime, startTime)
            )
            .with("ArrowDown", "ArrowLeft", () =>
                controller.getPrevValidTime(endTime, startTime)
            )
            .with("PageUp", () => controller.getLargeStepForward(endTime))
            .with("PageDown", () => controller.getLargeStepBackward(endTime))
            .with("Home", () => controller.minTime)
            .with("End", () => controller.maxTime)
            .exhaustive()
    }

    @action.bound updateStartTimeOnKeyDown(key: NavigationKey): void {
        const { controller } = this
        match(key)
            .with("Home", () => controller.resetStartToMin())
            .with("End", () => controller.setStartToMax())
            .with("ArrowLeft", "ArrowDown", () =>
                controller.decreaseStartTime()
            )
            .with("ArrowRight", "ArrowUp", () => controller.increaseStartTime())
            .with("PageUp", () => controller.increaseStartTimeByLargeStep())
            .with("PageDown", () => controller.decreaseStartTimeByLargeStep())
            .exhaustive()
    }

    @action.bound updateEndTimeOnKeyDown(key: NavigationKey): void {
        const { controller } = this
        const shouldMoveBothHandles = !this.areBothHandlesVisible
        match(key)
            .with("Home", () => controller.setEndToMin())
            .with("End", () => controller.resetEndToMax())
            .with("ArrowLeft", "ArrowDown", () => {
                controller.decreaseEndTime()
                if (shouldMoveBothHandles) controller.decreaseStartTime()
            })
            .with("ArrowRight", "ArrowUp", () => {
                controller.increaseEndTime()
                if (shouldMoveBothHandles) controller.increaseStartTime()
            })
            .with("PageUp", () => {
                controller.increaseEndTimeByLargeStep()
                if (shouldMoveBothHandles)
                    controller.increaseStartTimeByLargeStep()
            })
            .with("PageDown", () => {
                controller.decreaseEndTimeByLargeStep()
                if (shouldMoveBothHandles)
                    controller.decreaseStartTimeByLargeStep()
            })
            .exhaustive()
    }

    convertToTime(time: number): number {
        if (time === -Infinity) return this.controller.minTime
        if (time === +Infinity) return this.controller.maxTime
        return time
    }

    @computed private get startHandleTooltip(): React.ReactNode {
        const { startTime } = this.controller

        if (!this.startTooltipVisible || !this.areBothHandlesVisible) {
            return undefined
        }

        const formattedStartTime = this.formatTime(this.controller.startTime)

        if (!this.canEditTimeViaTooltip) {
            return <SimpleTimeTooltip formattedTime={formattedStartTime} />
        }

        const isEditing = this.editHandle === MarkerType.Start

        const isDateValid = (date: CalendarDate): boolean => {
            const { minTime, endTime, allowHandlesOnSameTime } = this.controller
            const time = calendarDateToDaysSinceEpoch(date)
            if (time < minTime) return false
            return allowHandlesOnSameTime ? time <= endTime : time < endTime
        }

        return this.isDailyData ? (
            <EditableDateTooltip
                position="left"
                isEditing={isEditing}
                formattedTime={formattedStartTime}
                currentTime={startTime}
                isDateValid={isDateValid}
                onStartEditing={() => this.onStartEditing(MarkerType.Start)}
                onComplete={this.onCompleteDate}
                onChange={this.onChangeDate}
            />
        ) : (
            <EditableYearTooltip
                position="left"
                isEditing={isEditing}
                currentTime={startTime}
                formattedTime={formattedStartTime}
                onStartEditing={() => this.onStartEditing(MarkerType.Start)}
                onComplete={this.onCompleteYear}
                onChange={this.onChangeYear}
                getTimeForKey={this.getStartTimeForNavigationKey}
                onMouseEnter={action(() => {
                    this.hoverTime = undefined
                })}
                onBlur={action(() => {
                    this.startTooltipVisible = false
                    this.endTooltipVisible = false
                })}
            />
        )
    }

    @computed private get endHandleTooltip(): React.ReactNode {
        const { endTime } = this.controller

        if (!this.endTooltipVisible) return undefined

        const formattedEndTime = this.formatTime(this.controller.endTime)

        if (!this.canEditTimeViaTooltip) {
            return <SimpleTimeTooltip formattedTime={formattedEndTime} />
        }

        // Avoid overlap with the hover tooltip when hovering to the right of the handle
        const position =
            this.hoverTime !== undefined &&
            this.hoverTime > this.controller.endTime
                ? "left"
                : "right"

        const isEditing = this.editHandle === MarkerType.End

        const isDateValid = (date: CalendarDate): boolean => {
            const { maxTime, startTime, allowHandlesOnSameTime } =
                this.controller
            const time = calendarDateToDaysSinceEpoch(date)
            if (time > maxTime) return false
            return allowHandlesOnSameTime ? time >= startTime : time > startTime
        }

        return this.isDailyData ? (
            <EditableDateTooltip
                position={position}
                isEditing={isEditing}
                formattedTime={formattedEndTime}
                currentTime={endTime}
                isDateValid={isDateValid}
                onStartEditing={() => this.onStartEditing(MarkerType.End)}
                onComplete={this.onCompleteDate}
                onChange={this.onChangeDate}
                onMouseEnter={action(() => {
                    this.hoverTime = undefined
                })}
            />
        ) : (
            <EditableYearTooltip
                position={position}
                isEditing={isEditing}
                currentTime={endTime}
                formattedTime={formattedEndTime}
                onStartEditing={() => this.onStartEditing(MarkerType.End)}
                onComplete={this.onCompleteYear}
                onChange={this.onChangeYear}
                getTimeForKey={this.getEndTimeForNavigationKey}
                onMouseEnter={action(() => {
                    this.hoverTime = undefined
                })}
                onBlur={action(() => {
                    this.startTooltipVisible = false
                    this.endTooltipVisible = false
                })}
            />
        )
    }

    @computed private get hoverTooltip(): React.ReactNode {
        const { hoverTime } = this

        if (!hoverTime) return undefined
        const formattedHoverTime = this.formatTime(hoverTime)

        if (!this.canEditTimeViaTooltip) {
            return <SimpleTimeTooltip formattedTime={formattedHoverTime} />
        }

        // Show on the left if hovering to the left of the existing handle,
        // right if hovering to the right of the existing handle
        const position = hoverTime < this.controller.endTime ? "left" : "right"

        // The hover tooltip is not editable (since it's impossible to click on
        // the tooltip), but it uses the same component for consistent styling
        return (
            <EditableYearTooltip
                position={position}
                currentTime={hoverTime}
                formattedTime={formattedHoverTime}
            />
        )
    }

    override render(): React.ReactElement {
        const { manager, controller, hoverTime } = this
        const {
            startTimeProgress,
            endTimeProgress,
            minTime,
            maxTime,
            startTime,
            endTime,
        } = controller

        const formattedMinTime = this.formatTime(minTime)
        const formattedMaxTime = this.formatTime(maxTime)
        const formattedStartTime = this.formatTime(startTime)
        const formattedEndTime = this.formatTime(endTime)
        const formattedHoverTime =
            hoverTime !== undefined ? this.formatTime(hoverTime) : undefined

        return (
            <div
                ref={this.base}
                className={cx(GRAPHER_TIMELINE_CLASS, {
                    [`${GRAPHER_TIMELINE_CLASS}--hover`]:
                        this.mouseHoveringOverTimeline,
                    [`${GRAPHER_TIMELINE_CLASS}--touch`]: this.isTouchDevice,
                })}
                style={{ padding: `0 ${GRAPHER_FRAME_PADDING_HORIZONTAL}px` }}
                role="group"
                aria-label="Timeline controls"
                onMouseOver={action((event) =>
                    this.onMouseOverSlider(event.nativeEvent)
                )}
                onMouseLeave={this.onMouseLeaveSlider}
                onMouseMove={action((event) =>
                    this.onMouseMoveSlider(event.nativeEvent)
                )}
            >
                {!this.manager.disablePlay && (
                    <ActionButton
                        className={PLAY_BUTTON_CLASS}
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
                <TimelineEdgeButton
                    formattedTime={formattedMinTime}
                    onClick={action(() => controller.resetStartToMin())}
                    onMouseEnter={action(() => {
                        if (this.shouldShowHoverTimeHandle)
                            this.hoverTime = minTime
                    })}
                    onMouseLeave={action(() => {
                        this.hoverTime = undefined
                    })}
                />
                <div
                    className={`${SLIDER_CLASS} clickable`}
                    role="group"
                    aria-label="Time range slider"
                    onMouseDown={(event) => this.onMouseDown(event.nativeEvent)}
                >
                    <TimelineHandle
                        className={MarkerType.Start}
                        ariaLabel={`Start time: ${formattedStartTime}`}
                        offsetPercent={startTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedStartTime}
                        tabIndex={this.areBothHandlesVisible ? 0 : -1}
                        onKeyDown={action((e) => {
                            if (isRelevantNavigationKey(e.key)) {
                                e.preventDefault() // Prevent scrolling
                                this.updateStartTimeOnKeyDown(e.key)
                            }
                        })}
                        onFocus={action(() => this.showTooltips())}
                        tooltip={this.startHandleTooltip}
                        zIndex={
                            this.lastUpdatedTooltip === MarkerType.Start ? 2 : 1
                        }
                    />
                    <TimelineInterval
                        startTimeProgress={startTimeProgress}
                        endTimeProgress={endTimeProgress}
                    />
                    {this.hoverTimeProgress !== undefined && (
                        <TimelineInterval
                            className="GrapherTimeline__HoverInterval"
                            startTimeProgress={Math.min(
                                startTimeProgress,
                                this.hoverTimeProgress
                            )}
                            endTimeProgress={Math.max(
                                startTimeProgress,
                                this.hoverTimeProgress
                            )}
                            ariaHidden={true}
                        />
                    )}
                    <TimelineHandle
                        className={MarkerType.End}
                        ariaLabel={`End time: ${formattedEndTime}`}
                        offsetPercent={endTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedEndTime}
                        onKeyDown={action((e) => {
                            if (isRelevantNavigationKey(e.key)) {
                                e.preventDefault() // prevent scrolling
                                this.updateEndTimeOnKeyDown(e.key)
                            }
                        })}
                        onFocus={action(() => this.showTooltips())}
                        tooltip={this.endHandleTooltip}
                        zIndex={
                            this.lastUpdatedTooltip === MarkerType.End ? 2 : 1
                        }
                    />
                    {this.hoverTimeProgress !== undefined &&
                        formattedHoverTime && (
                            <TimelineHandle
                                className={MarkerType.Hover}
                                tabIndex={-1}
                                offsetPercent={this.hoverTimeProgress * 100}
                                formattedMinTime={formattedMinTime}
                                formattedMaxTime={formattedMaxTime}
                                formattedCurrTime={formattedHoverTime}
                                tooltip={this.hoverTooltip}
                                zIndex={3}
                            />
                        )}
                </div>
                <TimelineEdgeButton
                    formattedTime={formattedMaxTime}
                    onClick={action(() => controller.resetEndToMax())}
                    onMouseEnter={action(() => {
                        if (this.shouldShowHoverTimeHandle)
                            this.hoverTime = maxTime
                    })}
                    onMouseLeave={action(() => {
                        this.hoverTime = undefined
                    })}
                />
            </div>
        )
    }
}

const TimelineEdgeButton = ({
    formattedTime,
    onClick,
    onMouseEnter,
    onMouseLeave,
}: {
    formattedTime: string
    onClick: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
}): React.ReactElement => {
    return (
        <button
            className="GrapherTimeline__TimelineEdgeButton"
            type="button"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            aria-label={`Jump to ${formattedTime}`}
        >
            {formattedTime}
        </button>
    )
}

function TimelineHandle({
    className,
    ariaLabel,
    offsetPercent,
    formattedMinTime,
    formattedMaxTime,
    formattedCurrTime,
    tooltip,
    tabIndex = 0,
    zIndex,
    onKeyDown,
    onFocus,
    onBlur,
}: {
    className?: string
    ariaLabel?: string
    offsetPercent: number
    formattedMinTime: string
    formattedMaxTime: string
    formattedCurrTime: string
    tooltip?: React.ReactNode
    tabIndex?: number
    zIndex?: number
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>
    onFocus?: React.FocusEventHandler<HTMLDivElement>
    onBlur?: React.FocusEventHandler<HTMLDivElement>
}): React.ReactElement {
    return (
        // @ts-expect-error aria-value* fields expect a number, but if we're dealing with daily data,
        // the numeric representation of a date is meaningless, so we pass the formatted date string instead.
        <div
            className={cx("GrapherTimeline__Handle", className)}
            style={{ left: `${offsetPercent}%`, zIndex }}
            role="slider"
            tabIndex={tabIndex}
            aria-valuemin={castToNumberIfPossible(formattedMinTime)}
            aria-valuenow={castToNumberIfPossible(formattedCurrTime)}
            aria-valuemax={castToNumberIfPossible(formattedMaxTime)}
            aria-valuetext={formattedCurrTime}
            aria-label={ariaLabel}
            aria-description="Use arrow keys to adjust by one step, Page Up/Down for larger steps, Home/End to jump to minimum/maximum."
            aria-orientation="horizontal"
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
        >
            <div className="GrapherTimeline__HandleKnob" />
            {tooltip}
        </div>
    )
}

function EditableYearTooltip({
    position,
    isEditing = false,
    currentTime,
    formattedTime,
    onStartEditing,
    onComplete,
    onChange,
    getTimeForKey,
    onMouseEnter,
    onMouseLeave,
    onBlur,
}: {
    position: "left" | "right"
    isEditing?: boolean
    currentTime: number
    formattedTime: string
    onStartEditing?: () => void
    onComplete?: (year?: number) => void
    onChange?: (year: number) => void
    getTimeForKey?: (key: NavigationKey) => number
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onBlur?: () => void
}): React.ReactElement {
    const [inputValue, setInputValue] = React.useState(currentTime.toString())

    React.useEffect(() => {
        if (isEditing) setInputValue(currentTime.toString())
    }, [isEditing, currentTime])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === ".") {
            // Prevent entering decimal points
            e.preventDefault()
        } else if (e.key === "Enter") {
            const parsed = parseIntOrUndefined(inputValue.trim())
            onComplete?.(parsed)
        } else if (e.key === "Escape") {
            onComplete?.()
        } else if (getTimeForKey && isRelevantNavigationKey(e.key)) {
            // Prevent default browser increment/decrement behavior
            e.preventDefault()

            const newTime = getTimeForKey(e.key)
            setInputValue(newTime.toString())
            onChange?.(newTime)
        }

        e.stopPropagation()
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const newValue = e.target.value
        setInputValue(newValue)
    }

    const handleBlur = (): void => {
        const parsed = parseIntOrUndefined(inputValue.trim())
        onComplete?.(parsed)
    }

    return (
        <div
            className={cx("EditableTimeTooltip", {
                "EditableTimeTooltip--left": position === "left",
                "EditableTimeTooltip--right": position === "right",
            })}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {isEditing ? (
                <div
                    className="EditableTimeTooltip__InputWrapper"
                    data-value={inputValue}
                >
                    <input
                        type="number"
                        className="EditableTimeTooltip__Input"
                        value={inputValue}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        onFocus={(e) => e.target.select()}
                        autoFocus
                        aria-label="Edit year"
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="EditableTimeTooltip__Button"
                    onClick={onStartEditing}
                    onBlur={onBlur}
                    aria-label={`Current year: ${formattedTime}. Click to edit.`}
                >
                    {formattedTime}
                </button>
            )}
        </div>
    )
}

function EditableDateTooltip({
    position,
    isEditing = false,
    currentTime,
    formattedTime,
    isDateValid = (): boolean => true,
    onStartEditing,
    onMouseEnter,
    onMouseLeave,
    onComplete,
    onChange,
}: {
    position: "left" | "right"
    isEditing?: boolean
    currentTime: number
    formattedTime: string
    isDateValid?: (date: CalendarDate) => boolean
    onStartEditing?: () => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onComplete: (date?: CalendarDate) => void
    onChange: (date: CalendarDate) => void
}): React.ReactElement {
    return (
        <div
            className={cx("EditableTimeTooltip", {
                "EditableTimeTooltip--left": position === "left",
                "EditableTimeTooltip--right": position === "right",
            })}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            onMouseDown={(e) => e.stopPropagation()}
        >
            {isEditing ? (
                <TimelineDateInput
                    value={daysSinceEpochToCalendarDate(currentTime)}
                    isDateValid={isDateValid}
                    onComplete={onComplete}
                    onChange={onChange}
                />
            ) : (
                <button
                    type="button"
                    className="EditableTimeTooltip__Button"
                    onClick={onStartEditing}
                    aria-label={`Current date: ${formattedTime}. Click to edit.`}
                >
                    {formattedTime}
                </button>
            )}
        </div>
    )
}

const TimelineDateInput = ({
    value,
    isDateValid,
    onComplete,
    onChange,
}: {
    value: CalendarDate
    isDateValid: (date: CalendarDate) => boolean
    onComplete: (date?: CalendarDate) => void
    onChange?: (date: CalendarDate) => void
}): React.ReactElement => {
    const [currentValue, setCurrentValue] = React.useState(value)
    const [shouldApplyImmediately, setShouldApplyImmediately] =
        React.useState(false)

    const handleKeyDown = (e: React.KeyboardEvent): void => {
        if (e.key === "Enter") {
            onComplete(currentValue)
        } else if (e.key === "Escape") {
            onComplete()
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // Apply immediately on arrow key changes
            setShouldApplyImmediately(true)
        } else {
            // Reset flag when typing (any other key)
            setShouldApplyImmediately(false)
        }
        e.stopPropagation()
    }

    const handleChange = (date: CalendarDate | null): void => {
        if (!date) return

        setCurrentValue(date)

        // If this change was triggered by arrow keys,
        // apply immediately without exiting edit mode
        if (shouldApplyImmediately) {
            if (!isDateValid(date)) return
            onChange?.(date)
            setShouldApplyImmediately(false)
        }
    }

    return (
        <DateField
            value={currentValue}
            onChange={handleChange}
            onBlur={() => onComplete(currentValue)}
            onKeyDown={handleKeyDown}
            className="GrapherTimeline__DateInput"
            aria-label="Edit date"
        >
            <DateInput className="GrapherTimeline__DateInputField">
                {(segment) => (
                    <DateSegment
                        segment={segment}
                        className="GrapherTimeline__DateInputSegment"
                    />
                )}
            </DateInput>
        </DateField>
    )
}

const TimelineInterval = ({
    startTimeProgress,
    endTimeProgress,
    className,
    ariaHidden,
}: {
    startTimeProgress: number
    endTimeProgress: number
    className?: string
    ariaHidden?: boolean
}): React.ReactElement => {
    const left = startTimeProgress * 100
    const right = 100 - endTimeProgress * 100
    return (
        <div
            className={cx("GrapherTimeline__Interval", className)}
            style={{ left: `${left}%`, right: `${right}%` }}
            role="presentation"
            aria-hidden={ariaHidden}
        />
    )
}

function SimpleTimeTooltip({
    formattedTime,
}: {
    formattedTime: string
}): React.ReactElement {
    return <div className="SimpleTimeTooltip">{formattedTime}</div>
}

/** Convert days-since-epoch integer to CalendarDate object */
export function daysSinceEpochToCalendarDate(
    daysSinceEpoch: number
): CalendarDate {
    const date = convertDaysSinceEpochToDate(daysSinceEpoch)
    return new CalendarDate(
        date.year(),
        date.month() + 1, // CalendarDate is 1-indexed, dayjs is 0-indexed
        date.date()
    )
}

/** Convert CalendarDate to days-since-epoch integer */
export function calendarDateToDaysSinceEpoch(date: CalendarDate): number {
    const year = date.year
    const month = date.month.toString().padStart(2, "0")
    const day = date.day.toString().padStart(2, "0")
    const isoString = `${year}-${month}-${day}`
    return diffDateISOStringInDays(isoString, EPOCH_DATE)
}

function isRelevantNavigationKey(key: string): key is NavigationKey {
    return NAVIGATION_KEYS.includes(key as NavigationKey)
}

function castToNumberIfPossible(s: string): string | number {
    return isNumber(s) ? +s : s
}

function isNumber(s: string): boolean {
    return /^\d+$/.test(s)
}
