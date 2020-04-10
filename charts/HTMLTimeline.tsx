import { select } from "d3-selection"
import { first, last, sortBy, min, max } from "./Util"
import * as React from "react"
import { Bounds } from "./Bounds"
import { getRelativeMouse } from "./Util"
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
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { faPlay } from "@fortawesome/free-solid-svg-icons/faPlay"
import { faPause } from "@fortawesome/free-solid-svg-icons/faPause"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

const UNBOUNDED = undefined

const MIN_YEAR = 1990
const MAX_YEAR = new Date().getFullYear()

function isUnbounded(year: number | undefined) {
    return year === undefined || !isFinite(year)
}

interface TimelineProps {
    years: number[]
    startYear: number | undefined
    endYear: number | undefined
    onTargetChange: ({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: number | undefined
        targetEndYear: number | undefined
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

    @observable startYearRaw: number | undefined
    @observable endYearRaw: number | undefined

    @observable isPlaying: boolean = false
    @observable dragTarget?: string

    @computed get isDragging(): boolean {
        return !!this.dragTarget
    }

    @computed get startYearRawOrDefault(): number {
        return min([this.startYearRaw, this.endYearRaw]) ?? MIN_YEAR
    }

    @computed get endYearRawOrDefault(): number {
        return max([this.startYearRaw, this.endYearRaw]) ?? MAX_YEAR
    }

    constructor(props: TimelineProps) {
        super(props)

        if (this.props.years.length === 0) {
            console.warn("invoking HTMLTimeline with empty years array")
        }
    }

    componentDidUpdate() {
        const { isPlaying, isDragging } = this
        if (!isPlaying && !isDragging) {
            runInAction(() => {
                this.startYearRaw = this.props.startYear
                this.endYearRaw = this.props.endYear
            })
        }
    }

    @computed get years(): number[] {
        return this.props.years
    }

    @computed get minYear(): number {
        return first(this.props.years) ?? MIN_YEAR
    }

    @computed get maxYear(): number {
        return last(this.props.years) ?? MAX_YEAR
    }

    getBoundedYear(inputYear: number): number {
        const { minYear, maxYear } = this
        return Math.min(maxYear, Math.max(minYear, inputYear))
    }

    getClosestYear(inputYear: number): number | undefined {
        const { years } = this
        return sortBy(years, year => Math.abs(year - inputYear))[0]
    }

    @computed get startYearUI(): number {
        if (this.startYearRaw === UNBOUNDED) {
            return this.props.singleYearMode ? this.maxYear : this.minYear
        }
        return this.startYearRawOrDefault
    }

    @computed get startYearRound(): number | undefined {
        if (isUnbounded(this.startYearRaw)) return this.startYearRaw
        return this.getClosestYear(this.startYearRawOrDefault)
    }

    @computed get endYearUI(): number {
        return this.endYearRaw === UNBOUNDED
            ? this.maxYear
            : this.endYearRawOrDefault
    }

    @computed get endYearRound(): number | undefined {
        if (isUnbounded(this.endYearRaw)) return this.endYearRaw
        return this.getClosestYear(this.endYearRawOrDefault)
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
                    this.isPlaying = false
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
        })

        this.animRequest = requestAnimationFrame(playFrame)
    }

    onStopPlaying() {
        if (this.animRequest !== undefined)
            cancelAnimationFrame(this.animRequest)
    }

    get sliderBounds() {
        const slider = this.base.current!.querySelector(".slider")
        return slider
            ? Bounds.fromRect(slider.getBoundingClientRect())
            : new Bounds(0, 0, 100, 100)
    }

    getInputYearFromMouse(evt: MouseEvent) {
        const slider = this.base.current!.querySelector(
            ".slider"
        ) as HTMLDivElement
        const sliderBounds = slider.getBoundingClientRect()

        const { minYear, maxYear } = this
        const mouseX = getRelativeMouse(slider, evt).x

        const fracWidth = mouseX / sliderBounds.width
        const inputYear = minYear + fracWidth * (maxYear - minYear)

        return inputYear
    }

    dragOffsets = [0, 0]

    @action.bound onStartYearChange(inputYear: number) {
        // `undefined` in start years is interpreted differently across charts, so we can't have it
        // unbounded yet.
        // E.g. in a line chart where the timeline is collapsed to a single year, therefore showing
        // a barchart, an unbounded start is interpreted as minimum (unbounded to the left).
        // But in a map, and unbounded start is interpreted as a maximum (unbounded to the right).
        this.startYearRaw = inputYear
    }

    @action.bound onEndYearChange(inputYear: number) {
        this.endYearRaw = inputYear >= this.maxYear ? UNBOUNDED : inputYear
    }

    @action.bound onSingleYearChange(inputYear: number) {
        // This method is only called when `singleYearMode` is `true` which is so far only map charts.
        // We can assume that maps will handle the unbounded start consistently.
        const year = inputYear >= this.maxYear ? UNBOUNDED : inputYear
        this.startYearRaw = year
        this.endYearRaw = year
    }

    @action.bound onRangeYearChange([startYear, endYear]: [number, number]) {
        this.startYearRaw = startYear
        // We dont want a scenario where startYear == maxYear and endYear is unbounded, because it
        // creates inconsistencies – e.g. a bar chart with that configuration will turn into a line
        // chart if data beyond maxTime becomes available (after a data update, or config update).
        this.endYearRaw =
            endYear >= this.maxYear && startYear < this.maxYear
                ? UNBOUNDED
                : endYear
    }

    @action.bound onDrag(inputYear: number) {
        const { props, dragTarget, minYear, maxYear } = this

        const boundedYear = this.getBoundedYear(inputYear)

        if (
            props.singleYearMode ||
            (this.isPlaying && this.props.singleYearPlay)
        ) {
            this.onSingleYearChange(boundedYear)
        } else if (dragTarget === "start") {
            this.onStartYearChange(boundedYear)
        } else if (dragTarget === "end") {
            this.onEndYearChange(boundedYear)
        } else if (dragTarget === "both") {
            let startYear = this.dragOffsets[0] + inputYear
            let endYear = this.dragOffsets[1] + inputYear

            if (startYear < minYear) {
                startYear = minYear
                endYear = this.getBoundedYear(
                    minYear + (this.dragOffsets[1] - this.dragOffsets[0])
                )
            } else if (endYear > maxYear) {
                startYear = this.getBoundedYear(
                    maxYear + (this.dragOffsets[0] - this.dragOffsets[1])
                )
                endYear = maxYear
            }

            this.onRangeYearChange([startYear, endYear])
        }
    }

    @action.bound onMouseDown(e: any) {
        // Don't do mousemove if we clicked the play or pause button
        const targetEl = select(e.target)
        if (targetEl.classed("toggle")) return

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
    }

    @action.bound onMouseUp() {
        this.dragTarget = undefined
    }

    // Allow proper dragging behavior even if mouse leaves timeline area
    componentDidMount() {
        runInAction(() => {
            this.startYearRaw = this.props.startYear
            this.endYearRaw = this.props.endYear
        })

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
            autorun(
                () => {
                    if (this.props.onTargetChange) {
                        this.props.onTargetChange({
                            targetStartYear: this.startYearRound,
                            targetEndYear: this.endYearRound
                        })
                    }
                },
                { delay: 0 }
            ),
            autorun(() => {
                // If we're not playing or dragging, lock the input to the closest year (no interpolation)
                const { isPlaying, isDragging } = this
                if (!isPlaying && !isDragging) {
                    action(() => {
                        this.startYearRaw = this.startYearRound
                        this.endYearRaw = this.endYearRound
                    })()
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
        this.isPlaying = !this.isPlaying
    }

    render() {
        const { minYear, maxYear, isPlaying, startYearUI, endYearUI } = this

        const startYearProgress = (startYearUI - minYear) / (maxYear - minYear)
        const endYearProgress = (endYearUI - minYear) / (maxYear - minYear)

        return (
            <div
                ref={this.base}
                className={"clickable TimelineControl"}
                onTouchStart={this.onMouseDown}
                onMouseDown={this.onMouseDown}
            >
                {!this.props.disablePlay && (
                    <div
                        onMouseDown={e => e.stopPropagation()}
                        onClick={this.onTogglePlay}
                    >
                        {isPlaying ? (
                            <FontAwesomeIcon icon={faPause} />
                        ) : (
                            <FontAwesomeIcon icon={faPlay} />
                        )}
                    </div>
                )}
                <div>{this.context.chart.formatYearFunction(minYear)}</div>
                <div className="slider">
                    <div
                        className="handle startMarker"
                        style={{ left: `${startYearProgress * 100}%` }}
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
                        style={{ left: `${endYearProgress * 100}%` }}
                    />
                </div>
                <div>{this.context.chart.formatYearFunction(maxYear)}</div>
            </div>
        )
    }
}
