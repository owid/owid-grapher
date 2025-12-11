import * as _ from "lodash-es"
import * as React from "react"
import { select } from "d3-selection"
import cx from "classnames"
import {
    getRelativeMouse,
    Bounds,
    Time,
    parseIntOrUndefined,
    isTouchDevice,
} from "@ourworldindata/utils"
import { observable, computed, action, makeObservable, reaction } from "mobx"
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
    private isEditableTimeTooltipHovered: boolean = false

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
            | "isEditableTimeTooltipHovered"
        >(this, {
            startTooltipVisible: observable,
            endTooltipVisible: observable,
            lastUpdatedTooltip: observable,
            hoverTime: observable,
            editHandle: observable,
            isEditableTimeTooltipHovered: observable,
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
        if (!inputTime) return

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
        if (inputTime) this.onDrag(inputTime)
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
            !this.editHandle &&
            !this.isEditableTimeTooltipHovered
        )
    }

    private setHoverTime(event: MouseEvent | TouchEvent): void {
        if (!this.shouldShowHoverTimeHandle) return

        const inputTime = this.getInputTimeFromMouse(event)
        if (!inputTime) return

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
        this.isEditableTimeTooltipHovered = false
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
        } else if (key === "PageUp") {
            controller.increaseStartTimeByLargeStep()
        } else if (key === "PageDown") {
            controller.decreaseStartTimeByLargeStep()
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
        } else if (key === "PageUp") {
            controller.increaseEndTimeByLargeStep()
        } else if (key === "PageDown") {
            controller.decreaseEndTimeByLargeStep()
        }
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

        return (
            <EditableYearTooltip
                type={MarkerType.Start}
                editHandle={this.editHandle}
                currentTime={startTime}
                formattedTime={formattedStartTime}
                onStartEditing={() => this.onStartEditing(MarkerType.Start)}
                onComplete={this.onCompleteYear}
                onChange={this.onChangeYear}
                onMouseEnter={action(() => {
                    this.isEditableTimeTooltipHovered = true
                    this.hoverTime = undefined
                })}
                onMouseLeave={action(() => {
                    this.isEditableTimeTooltipHovered = false
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

        return (
            <EditableYearTooltip
                type={MarkerType.End}
                editHandle={this.editHandle}
                currentTime={endTime}
                formattedTime={formattedEndTime}
                onStartEditing={() => this.onStartEditing(MarkerType.End)}
                onComplete={this.onCompleteYear}
                onChange={this.onChangeYear}
                onMouseEnter={action(() => {
                    this.isEditableTimeTooltipHovered = true
                    this.hoverTime = undefined
                })}
                onMouseLeave={action(() => {
                    this.isEditableTimeTooltipHovered = false
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

        // Show to the left if hovering over start handle, right if hovering over end handle
        const type =
            hoverTime < this.controller.endTime
                ? MarkerType.Start
                : MarkerType.End

        // The hover tooltip is not editable (since it's impossible to click on
        // the tooltip), but it uses the same component for consistent styling
        return (
            <EditableYearTooltip
                type={type}
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
                    aria-label="Timeline slider"
                    onMouseDown={(event) => this.onMouseDown(event.nativeEvent)}
                >
                    <TimelineHandle
                        className={MarkerType.Start}
                        ariaLabel="Start time"
                        offsetPercent={startTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedStartTime}
                        tabIndex={this.areBothHandlesVisible ? 0 : -1}
                        onKeyDown={action((e) => {
                            // Prevent scrolling
                            if (
                                e.key === "Home" ||
                                e.key === "End" ||
                                e.key === "PageUp" ||
                                e.key === "PageDown"
                            )
                                e.preventDefault()

                            this.updateStartTimeOnKeyDown(e.key)
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
                        ariaLabel="End time"
                        offsetPercent={endTimeProgress * 100}
                        formattedMinTime={formattedMinTime}
                        formattedMaxTime={formattedMaxTime}
                        formattedCurrTime={formattedEndTime}
                        onKeyDown={action((e) => {
                            // prevent browser to scroll to the top or bottom of the page
                            if (
                                e.key === "Home" ||
                                e.key === "End" ||
                                e.key === "PageUp" ||
                                e.key === "PageDown"
                            )
                                e.preventDefault()

                            this.updateEndTimeOnKeyDown(e.key)
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
    type,
    editHandle,
    currentTime,
    formattedTime,
    onStartEditing,
    onComplete,
    onChange,
    onMouseEnter,
    onMouseLeave,
    onBlur,
}: {
    type: Exclude<MarkerType, MarkerType.Hover>
    editHandle?: Exclude<MarkerType, MarkerType.Hover>
    currentTime: number
    formattedTime: string
    onStartEditing?: () => void
    onComplete?: (year?: number) => void
    onChange?: (year: number) => void
    onMouseEnter?: () => void
    onMouseLeave?: () => void
    onBlur?: () => void
}): React.ReactElement {
    const [inputValue, setInputValue] = React.useState(currentTime.toString())
    const [shouldApplyImmediately, setShouldApplyImmediately] =
        React.useState(false)

    const isEditing = editHandle === type

    React.useEffect(() => {
        if (isEditing) setInputValue(currentTime.toString())
    }, [isEditing, currentTime])

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
        if (e.key === "Enter") {
            const parsed = parseIntOrUndefined(inputValue.trim())
            onComplete?.(parsed)
        } else if (e.key === "Escape") {
            onComplete?.()
        } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            // Apply immediately on arrow key changes
            setShouldApplyImmediately(true)
        }
        e.stopPropagation()
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const newValue = e.target.value
        setInputValue(newValue)

        // If this change was triggered by arrow keys,
        // apply immediately without exiting edit mode
        if (shouldApplyImmediately) {
            const parsed = parseIntOrUndefined(newValue.trim())
            if (parsed !== undefined) onChange?.(parsed)
            setShouldApplyImmediately(false)
        }
    }

    const handleBlur = (): void => {
        const parsed = parseIntOrUndefined(inputValue.trim())
        onComplete?.(parsed)
    }

    return (
        <div
            className={cx("EditableTimeTooltip", {
                "EditableTimeTooltip--left": type === MarkerType.Start,
                "EditableTimeTooltip--right": type === MarkerType.End,
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
                    />
                </div>
            ) : (
                <button
                    type="button"
                    className="EditableTimeTooltip__Button"
                    onClick={onStartEditing}
                    onBlur={onBlur}
                >
                    {formattedTime}
                </button>
            )}
        </div>
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

function castToNumberIfPossible(s: string): string | number {
    return isNumber(s) ? +s : s
}

function isNumber(s: string): boolean {
    return /^\d+$/.test(s)
}
