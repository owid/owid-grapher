import { select } from "d3-selection"
import { first, last, sortBy, find } from "./Util"
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

interface TimelineProps {
    years: number[]
    startYear: number
    endYear: number
    onTargetChange: ({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: number
        targetEndYear: number
    }) => void
    onInputChange?: ({
        startYear,
        endYear
    }: {
        startYear: number
        endYear: number
    }) => void
    onStartDrag?: () => void
    onStopDrag?: () => void
    yearIsDay?: boolean
    zeroDay?: string
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

    @observable startYearInput: number = 1900
    @observable endYearInput: number = 2000
    @observable isPlaying: boolean = false
    @observable dragTarget?: string

    @computed get isDragging(): boolean {
        return !!this.dragTarget
    }

    constructor(props: TimelineProps) {
        super(props)

        if (this.props.years.length === 0) {
            // Lots of stuff in this class assumes the years array is non-empty,
            // see e.g. minYear, maxYear, targetStartYear, targetEndYear. Should
            // deal with this more gracefully -@jasoncrawford 2019-12-17
            console.warn("invoking HTMLTimeline with empty years array")
        }

        runInAction(() => {
            this.startYearInput = props.startYear
            this.endYearInput = props.endYear
        })
    }

    componentDidUpdate() {
        const { isPlaying, isDragging } = this
        if (!isPlaying && !isDragging) {
            runInAction(() => {
                this.startYearInput = this.props.startYear
                this.endYearInput = this.props.endYear
            })
        }
    }

    @computed get years(): number[] {
        return this.props.years
    }

    @computed get minYear(): number {
        // This cast is necessary because `years` might be empty. Should deal
        // with an empty years array more gracefully -@jasoncrawford 2019-12-17
        return first(this.props.years) as number
    }

    @computed get maxYear(): number {
        // This cast is necessary because `years` might be empty. Should deal
        // with an empty years array more gracefully -@jasoncrawford 2019-12-17
        return last(this.props.years) as number
    }

    // Sanity check the input
    @computed get startYear(): number {
        const { startYearInput, endYearInput, minYear, maxYear } = this
        return Math.min(
            maxYear,
            Math.max(minYear, Math.min(startYearInput, endYearInput))
        )
    }

    // Closest year to the input start year
    // e.g. 1954 => 1955
    @computed get roundedStartYear(): number {
        const { years, startYear } = this
        return sortBy(years, year => Math.abs(year - startYear))[0]
    }

    // Previous year from the input start year
    // e.g. 1954 => 1950
    @computed get targetStartYear(): number {
        const { years, startYear } = this
        return find(
            sortBy(years, year => Math.abs(year - startYear)),
            year => year <= startYear
        ) as number
    }

    @computed get endYear(): number {
        const { startYearInput, endYearInput, minYear, maxYear } = this
        return Math.min(
            maxYear,
            Math.max(minYear, Math.max(startYearInput, endYearInput))
        )
    }

    @computed get roundedEndYear(): number {
        const { years, endYear } = this
        return sortBy(years, year => Math.abs(year - endYear))[0]
    }

    @computed get targetEndYear(): number {
        const { years, endYear } = this
        return find(
            sortBy(years, year => Math.abs(year - endYear)),
            year => year <= endYear
        ) as number
    }

    animRequest?: number

    @action.bound onStartPlaying() {
        Analytics.logEvent("CHART_TIMELINE_PLAY")

        let lastTime: number | undefined
        const ticksPerSec = 5

        const playFrame = action((time: number) => {
            const { isPlaying, endYear, years, minYear, maxYear } = this
            if (!isPlaying) return

            if (lastTime === undefined) {
                // If we start playing from the end, loop around to beginning
                if (endYear >= maxYear) {
                    this.startYearInput = minYear
                    this.endYearInput = minYear
                }
            } else {
                const elapsed = time - lastTime

                if (endYear >= maxYear) {
                    this.isPlaying = false
                } else {
                    const nextYear = years[years.indexOf(endYear) + 1]
                    const yearsToNext = nextYear - endYear

                    this.endYearInput =
                        endYear +
                        (Math.max(yearsToNext / 3, 1) * elapsed * ticksPerSec) /
                            1000
                    if (this.props.singleYearMode || this.props.singleYearPlay)
                        this.startYearInput = this.endYearInput
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

    @action.bound onDrag(inputYear: number) {
        const { props, dragTarget, minYear, maxYear } = this

        if (
            props.singleYearMode ||
            (this.isPlaying && this.props.singleYearPlay)
        ) {
            this.startYearInput = inputYear
            this.endYearInput = inputYear
        } else if (dragTarget === "start") this.startYearInput = inputYear
        else if (dragTarget === "end") this.endYearInput = inputYear
        else if (dragTarget === "both") {
            this.startYearInput = this.dragOffsets[0] + inputYear
            this.endYearInput = this.dragOffsets[1] + inputYear

            if (this.startYearInput < minYear) {
                this.startYearInput = minYear
                this.endYearInput =
                    minYear + (this.dragOffsets[1] - this.dragOffsets[0])
            } else if (this.endYearInput > maxYear) {
                this.startYearInput =
                    maxYear + (this.dragOffsets[0] - this.dragOffsets[1])
                this.endYearInput = maxYear
            }
        }
    }

    @action.bound onMouseDown(e: any) {
        // Don't do mousemove if we clicked the play or pause button
        const targetEl = select(e.target)
        if (targetEl.classed("toggle")) return

        const { startYear, endYear } = this
        const { singleYearMode } = this.props

        const inputYear = this.getInputYearFromMouse(e)
        if (
            startYear === endYear &&
            (targetEl.classed("startMarker") || targetEl.classed("endMarker"))
        )
            this.dragTarget = "both"
        else if (
            !singleYearMode &&
            (targetEl.classed("startMarker") || inputYear <= startYear)
        )
            this.dragTarget = "start"
        else if (
            !singleYearMode &&
            (targetEl.classed("endMarker") || inputYear >= endYear)
        )
            this.dragTarget = "end"
        else this.dragTarget = "both"

        if (this.dragTarget === "both")
            this.dragOffsets = [
                this.startYearInput - inputYear,
                this.endYearInput - inputYear
            ]

        this.onDrag(inputYear)

        e.preventDefault()
    }

    @action.bound onDoubleClick(e: any) {
        const inputYear = this.getInputYearFromMouse(e)
        this.startYearInput = inputYear
        this.endYearInput = inputYear
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
                    if (this.props.onInputChange)
                        this.props.onInputChange({
                            startYear: this.startYear,
                            endYear: this.endYear
                        })
                },
                { delay: 0 }
            ),
            autorun(
                () => {
                    if (this.props.onTargetChange)
                        this.props.onTargetChange({
                            targetStartYear: this.targetStartYear,
                            targetEndYear: this.targetEndYear
                        })
                },
                { delay: 0 }
            ),
            autorun(() => {
                // If we're not playing or dragging, lock the input to the closest year (no interpolation)
                const {
                    isPlaying,
                    isDragging,
                    roundedStartYear,
                    roundedEndYear
                } = this
                if (!isPlaying && !isDragging) {
                    action(() => {
                        this.startYearInput = roundedStartYear
                        this.endYearInput = roundedEndYear
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
        const { minYear, maxYear, isPlaying, startYear, endYear } = this

        const startYearProgress = (startYear - minYear) / (maxYear - minYear)
        const endYearProgress = (endYear - minYear) / (maxYear - minYear)

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
