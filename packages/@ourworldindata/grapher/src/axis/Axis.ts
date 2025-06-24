import * as _ from "lodash-es"
import { scaleLog, scaleLinear, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { observable, computed } from "mobx"
import {
    rollingMap,
    numberMagnitude,
    Bounds,
    DEFAULT_BOUNDS,
    AxisAlign,
    HorizontalAlign,
    Position,
    ScaleType,
    VerticalAlign,
    TickFormattingOptions,
    Tickmark,
    ValueRange,
    OwidVariableRoundingMode,
} from "@ourworldindata/utils"
import { AxisConfig, AxisManager } from "./AxisConfig"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { ColumnTypeMap, CoreColumn } from "@ourworldindata/core-table"
import { GRAPHER_FONT_SCALE_12 } from "../core/GrapherConstants.js"
import { makeAxisLabel } from "../chart/ChartUtils"
import * as R from "remeda"

interface TickLabelPlacement {
    value: number
    formattedValue: string
    x: number
    y: number
    width: number
    height: number
    xAlign?: HorizontalAlign
    yAlign?: VerticalAlign
    isHidden: boolean
}

type Scale = ScaleLinear<number, number> | ScaleLogarithmic<number, number>

const OUTER_PADDING = 4

const doIntersect = (bounds: Bounds, bounds2: Bounds): boolean => {
    return bounds.intersects(bounds2)
}

const boundsFromLabelPlacement = (label: TickLabelPlacement): Bounds => {
    const { x, y, width, height, xAlign, yAlign } = label
    const xShift =
        xAlign === HorizontalAlign.center
            ? -width / 2
            : xAlign === HorizontalAlign.right
              ? -width
              : 0
    const yShift =
        yAlign === VerticalAlign.middle
            ? -height / 2
            : yAlign === VerticalAlign.bottom
              ? -height
              : 0
    return new Bounds(x + xShift, y + yShift, width, height)
}

abstract class AbstractAxis {
    config: AxisConfig
    axisManager?: AxisManager

    @observable.ref domain: ValueRange
    @observable formatColumn?: CoreColumn // Pass the column purely for formatting reasons. Might be a better way to do this.
    @observable hideFractionalTicks = false
    @observable.struct range: ValueRange = [0, 0]
    @observable private _scaleType?: ScaleType
    @observable private _label?: string

    constructor(config: AxisConfig, axisManager?: AxisManager) {
        this.config = config
        this.domain = [config.domain[0], config.domain[1]]
        this.axisManager = axisManager
    }

    /**
     * The orthogonal size of the axis.
     * For horizontal axes, this is the height.
     * For vertical axes, this is the width.
     */
    abstract get size(): number
    abstract get orient(): Position
    abstract get labelMaxWidth(): number

    abstract placeTickLabel(value: number): TickLabelPlacement
    abstract get tickLabels(): TickLabelPlacement[]

    @computed get hideAxis(): boolean {
        return this.config.hideAxis ?? false
    }

    @computed get hideGridlines(): boolean {
        return this.config.hideGridlines ?? false
    }

    @computed get tickPadding(): number {
        return this.config.tickPadding ?? 5
    }

    @computed get labelPadding(): number {
        return this.config.labelPadding ?? 10
    }

    @computed get labelPosition(): AxisAlign {
        return this.config.labelPosition ?? AxisAlign.middle
    }

    @computed get nice(): boolean {
        return this.config.nice ?? false
    }

    @computed get fontSize(): number {
        return this.config.fontSize
    }

    @computed protected get minTicks(): number {
        return 2
    }

    @computed private get maxTicks(): number {
        return this.config.maxTicks ?? 6
    }

    @computed get canChangeScaleType(): boolean | undefined {
        return this.config.canChangeScaleType
    }

    @computed get scaleType(): ScaleType {
        return this._scaleType ?? this.config.scaleType ?? ScaleType.linear
    }

    set scaleType(value: ScaleType) {
        this._scaleType = value
    }

    @computed get label(): string {
        return this._label ?? this.config.label ?? ""
    }

    set label(value: string) {
        this._label = value
    }

    // This will expand the domain but never shrink.
    // This will change the min unless the user's min setting is less
    // This will change the max unless the user's max setting is greater
    // Undefined values are ignored
    updateDomainPreservingUserSettings(
        domain: [number | undefined, number | undefined]
    ): this {
        const left =
            domain[0] !== undefined
                ? _.min([this.domain[0], domain[0]])
                : this.domain[0]
        const right =
            domain[1] !== undefined
                ? _.max([this.domain[1], domain[1]])
                : this.domain[1]
        this.domain = [left ?? 0, right ?? 0]
        return this
    }

    // todo: refactor. switch to a parent pattern?
    _update(parentAxis: AbstractAxis): this {
        this.formatColumn = parentAxis.formatColumn
        this.domain = parentAxis.domain.slice() as ValueRange
        this.hideFractionalTicks = parentAxis.hideFractionalTicks
        this.range = parentAxis.range.slice() as ValueRange
        this._scaleType = parentAxis._scaleType
        this._label = parentAxis._label
        return this
    }

    private static calculateBandWidth({
        values,
        scale,
    }: {
        values: number[]
        scale: Scale
    }): number {
        const range = scale.range()
        const rangeSize = Math.abs(range[1] - range[0])
        const maxBandWidth = 0.4 * rangeSize

        if (values.length < 2) return maxBandWidth

        // the band width is the smallest distance between
        // two adjacent values placed on the axis
        const sortedValues = _.sortBy(values)
        const positions = sortedValues.map((value) => scale(value))
        const diffs = positions
            .slice(1)
            .map((pos, index) => pos - positions[index])
        const bandWidth = _.min(diffs) ?? 0

        return _.min([bandWidth, maxBandWidth]) ?? 0
    }

    /**
     * Maximum width a single value can take up on the axis.
     * Not meaningful if no domain values are given.
     */
    @computed get bandWidth(): number | undefined {
        const { domainValues } = this.config
        if (!domainValues) return undefined
        return AbstractAxis.calculateBandWidth({
            values: domainValues,
            scale: this.d3_scale,
        })
    }

    private static makeScaleNice(
        scale: ScaleLinear<number, number>,
        totalTicksTarget: number
    ): { scale: ScaleLinear<number, number>; ticks?: number[] } {
        let ticks = scale.ticks(totalTicksTarget)

        // use d3's nice function when there is only one tick
        if (ticks.length < 2) return { scale: scale.nice(totalTicksTarget) }

        const tickStep = ticks[1] - ticks[0]
        const firstTick = ticks[0]
        const lastTick = R.last(ticks)!

        // if the the max or min value exceeds the last grid line by more than 25%,
        // expand the domain to include an additional grid line
        const [minValue, maxValue] = scale.domain()
        if (maxValue > lastTick + 0.25 * tickStep) {
            scale.domain([scale.domain()[0], lastTick + tickStep])
            ticks = [...ticks, lastTick + tickStep]
        }
        if (minValue < firstTick - 0.25 * tickStep) {
            scale.domain([firstTick - tickStep, scale.domain()[1]])
            ticks = [firstTick - tickStep, ...ticks]
        }

        return { scale, ticks }
    }

    private niceTicks?: number[]
    @computed private get d3_scale(): Scale {
        const isLogScale = this.scaleType === ScaleType.log
        const d3Scale = isLogScale ? scaleLog : scaleLinear
        let scale = d3Scale().domain(this.domain).range(this.range)

        if (this.nice && !isLogScale) {
            const { scale: niceScale, ticks: niceTicks } =
                AbstractAxis.makeScaleNice(scale, this.totalTicksTarget)
            scale = niceScale
            this.niceTicks = niceTicks
        } else {
            this.niceTicks = undefined
        }

        if (this.config.domainValues) {
            // compute bandwidth and adjust the scale
            const bandWidth = AbstractAxis.calculateBandWidth({
                values: this.config.domainValues,
                scale,
            })
            const offset = bandWidth / 2 + OUTER_PADDING
            const r = scale.range()
            return scale.range([r[0] + offset, r[1] - offset])
        } else {
            return scale
        }
    }

    @computed get rangeSize(): number {
        return Math.abs(this.range[1] - this.range[0])
    }

    @computed get rangeMax(): number {
        return Math.max(this.range[1], this.range[0])
    }

    @computed get rangeMin(): number {
        return Math.min(this.range[1], this.range[0])
    }

    @computed get rangeCenter(): number {
        return this.rangeMin + this.rangeSize / 2
    }

    /** The number of ticks we should _aim_ to show, not necessarily a strict target. */
    @computed private get totalTicksTarget(): number {
        // Chose 1.8 here by trying a bunch of different faceted charts and figuring out what
        // a reasonable lower bound is.
        // NOTE: This setting is used between both log & linear axes, check both when tweaking.
        // -@danielgavrilov, 2021-06-15
        return Math.round(
            R.clamp(this.rangeSize / (this.fontSize * 1.8), {
                min: this.minTicks,
                max: this.maxTicks,
            })
        )
    }

    getTickValues(): Tickmark[] {
        const { scaleType, d3_scale } = this

        let ticks: Tickmark[]

        if (this.config.ticks) {
            // If custom ticks are supplied, use them without any transformations or additions.
            const [minValue, maxValue] = d3_scale.domain()
            return (
                this.config.ticks
                    // replace ±Infinity with minimum/maximum
                    .map((tick) => {
                        if (tick.value === -Infinity)
                            return { ...tick, value: minValue }
                        if (tick.value === Infinity)
                            return { ...tick, value: maxValue }
                        return tick
                    })
                    // filter out custom ticks outside the plottable area
                    .filter(
                        (tick) =>
                            tick.value >= minValue && tick.value <= maxValue
                    )
            )
        } else if (scaleType === ScaleType.log) {
            // Show a bit more ticks for log axes
            const maxLabelledTicks = Math.round(this.totalTicksTarget * 1.25)
            const maxTicks = Math.round(this.totalTicksTarget * 3)

            // This is a wild heuristic that decides how many tick lines and grid lines we want to
            // show for log charts.
            //
            // It tries to achive multiple goals:
            // * make it obvious for the user which values they're looking at
            // * ideally, make it very clear that this is a log axis by looking like log paper
            // * (but) don't overwhelm the user
            // * avoid cases where only one tick is shown for the whole axis (we had those!)
            //
            // This code roughly works as follows:
            // First, we let d3 generate ticks for the axis. d3 gives values of the form `y * 10^x`,
            // with 0 < y < 10.
            // We then assign priorities to these values:
            // * priority 1 (highest) to values of the form `1 * 10^x` (e.g. 100)
            // * priority 2 to values of the form `2 * 10^x` or `5 * 10^x` (e.g. 5, 2000)
            // * priority 3 (lowest) to all other ("in-between") values (e.g. 70, 300)
            //
            // We then decide depending on the number of tick candidates what to do:
            // * if we have less than `maxLabelledTicks`, just show all
            // * if we have between `maxLabelledTicks` and `maxTicks`, show all "in-between" lines
            //   as faint grid lines without labels to give the chart that log paper look.
            //   We also show all priority 1 and 2 lines with labels, because there aren't too many
            //   of them.
            // * otherwise, remove priority 3 and, if necessary, priority 2 labels until we're below
            //   `maxLabelledTicks` labels overall
            //
            // -@MarcelGerber, 2020-08-07
            const tickCandidates = d3_scale.ticks(maxLabelledTicks)
            ticks = tickCandidates.map((value) => {
                // 10^x
                if (Math.fround(Math.log10(value)) % 1 === 0)
                    return { value, priority: 1 }
                // 5 * 10^x
                else if (Math.fround(Math.log10(value * 2)) % 1 === 0)
                    return { value, priority: 2 }
                // 2 * 10^x
                else if (Math.fround(Math.log10(value / 2)) % 1 === 0)
                    return { value, priority: 2 }
                return { value, priority: 3 }
            })

            if (ticks.length > maxLabelledTicks) {
                if (ticks.length <= maxTicks) {
                    // Convert all "in-between" lines to faint grid lines without labels
                    ticks = ticks.map((tick) => {
                        if (tick.priority === 3)
                            tick = {
                                ...tick,
                                faint: true,
                                gridLineOnly: true,
                            }
                        return tick
                    })
                } else {
                    // Remove some tickmarks again because the chart would get too overwhelming
                    // otherwise
                    for (let priority = 3; priority > 1; priority--) {
                        if (ticks.length > maxLabelledTicks)
                            ticks = ticks.filter(
                                (tick) => tick.priority < priority
                            )
                    }
                }
            }
        } else {
            const d3_ticks =
                this.niceTicks ?? d3_scale.ticks(this.totalTicksTarget)

            // Only use priority 2 here because we want the start / end ticks
            // to be priority 1
            ticks = d3_ticks.map((tickValue) => ({
                value: tickValue,
                priority: 2,
            }))
        }

        if (this.hideFractionalTicks)
            ticks = ticks.filter((t) => t.value % 1 === 0)

        // mark value=0 ticks as solid for non-time columns
        if (!(this.formatColumn instanceof ColumnTypeMap.Time)) {
            ticks = ticks.map((tick) =>
                tick.value === 0 ? { ...tick, solid: true } : tick
            )
        }

        return _.uniq(ticks)
    }

    private getTickFormattingOptions(): TickFormattingOptions {
        const options: TickFormattingOptions = {
            ...this.config.tickFormattingOptions,
            roundingMode: OwidVariableRoundingMode.decimalPlaces,
        }

        // The chart's tick formatting function is used by default to format axis ticks. This means
        // that the chart's `numDecimalPlaces` is also used by default to format the axis ticks.
        //
        // However, the author-specified decimal places are not always appropriate for rendering
        // ticks, because:
        // 1. Subsets of the data may require higher fidelity, e.g. users can use the timeline to
        //    end up in a subset of the dataset where values happen to be much lower than usual.
        // 2. Ticks may be rendered at granularities that may not exist in the data, e.g. the data
        //    may only contain 0 and 1, but we may show ticks in between those values.
        //
        // Therefore, when formatting ticks, we determine the `numDecimalPlaces` automatically, by
        // finding the smallest difference between any pair of ticks and making sure that we have
        // sufficient decimal places to express the difference to the first significant figure (the
        // first non-zero digit).
        //
        // One significant figure is sufficient because we use D3's ticks() and that creates
        // "uniformly-spaced, nicely-rounded values [...] where each value is a power of ten
        // multiplied by 1, 2 or 5"
        // See: https://github.com/d3/d3-array/blob/master/README.md#ticks
        //
        // -@danielgavrilov, 2020-05-27
        const minDist = _.min(
            rollingMap(this.baseTicks, (a, b) => Math.abs(a.value - b.value))
        )
        if (minDist !== undefined) {
            // Find the decimal places required to reach the first non-zero digit
            const dp = -numberMagnitude(minDist) + 1
            if (dp >= 0) {
                options.numDecimalPlaces = dp
            }
        }
        return options
    }

    place(value: number): number {
        if (!this.range) {
            console.error(
                "Can't place value on scale without a defined output range"
            )
            return value
        } else if (this.scaleType === ScaleType.log && value <= 0) {
            console.error(`Can't have ${value} which is <= 0 on a log scale`)
            return value
        } else if (this.domain[0] === this.domain[1]) {
            // When the domain is a single value, the D3 scale will by default place
            // the value at the middle of the range.
            // We instead want to customize what happens - sometimes we want to place the point
            // at the start of the range instead.
            // see https://github.com/owid/owid-grapher/pull/1367#issuecomment-1090845181.
            //
            // -@marcelgerber, 2022-04-12
            switch (this.config.singleValueAxisPointAlign) {
                case AxisAlign.start:
                    return this.range[0]
                case AxisAlign.end:
                    return this.range[1]
                case AxisAlign.middle:
                default:
                    return (this.range[0] + this.range[1]) / 2
            }
        }
        const placedValue = this.d3_scale(value)
        if (placedValue === undefined) {
            console.error(`Placed value is undefined for ${value}`)
            return value
        }
        return parseFloat(placedValue.toFixed(1))
    }

    /** This function returns the inverse of place - i.e. given a screen space
     *  coordinate, it returns the corresponding domain value. This is useful
     *  for cases where you want to make sure that something is at least one pixel high.
     */
    invert(value: number): number {
        return this.d3_scale.invert(value)
    }

    @computed get tickFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    @computed protected get baseTicks(): Tickmark[] {
        return this.getTickValues().filter((tick) => !tick.gridLineOnly)
    }

    formatTick(
        tick: number,
        formattingOptionsOverride?: TickFormattingOptions
    ): string {
        const tickFormattingOptions: TickFormattingOptions = {
            ...this.getTickFormattingOptions(),
            ...formattingOptionsOverride,
        }
        return (
            this.formatColumn?.formatForTick(tick, tickFormattingOptions) ??
            tick.toString()
        )
    }

    @computed get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_12 * this.fontSize)
    }

    @computed get labelTextWrap(): MarkdownTextWrap | undefined {
        if (!this.label) return

        const textWrapProps = {
            maxWidth: this.labelMaxWidth,
            fontSize: this.labelFontSize,
            lineHeight: 1,
            detailsOrderedByReference:
                this.axisManager?.detailsOrderedByReference,
        }

        const axisLabel = makeAxisLabel({
            label: this.label,
            unit: this.formatColumn?.unit,
            shortUnit: this.formatColumn?.shortUnit,
        })

        if (axisLabel.unit) {
            return MarkdownTextWrap.fromFragments({
                main: { text: axisLabel.mainLabel, bold: true },
                secondary: { text: `(${axisLabel.unit})` },
                newLine: "avoid-wrap",
                textWrapProps,
            })
        }

        return new MarkdownTextWrap({
            text: axisLabel.mainLabel,
            fontWeight: 700,
            ...textWrapProps,
        })
    }

    @computed get labelHeight(): number {
        return this.labelTextWrap
            ? this.labelTextWrap.height + this.labelPadding
            : 0
    }
}

export class HorizontalAxis extends AbstractAxis {
    clone(): HorizontalAxis {
        return new HorizontalAxis(this.config, this.axisManager)._update(this)
    }

    @computed get orient(): Position {
        // Default to `bottom` unless overriden to `top`.
        return this.config.orient === Position.top
            ? Position.top
            : Position.bottom
    }

    @computed get labelOffset(): number {
        return this.labelHeight
    }

    @computed get labelMaxWidth(): number {
        return this.rangeSize
    }

    // note that we intentionally don't take `hideAxisLabels` into account here.
    // tick labels might be hidden in faceted charts. when faceted, it's important
    // the axis size doesn't change as a result of hiding the axis labels, or else
    // we might end up with misaligned axes.
    @computed get height(): number {
        if (this.hideAxis) return 0
        const { labelOffset, tickPadding } = this
        const maxTickHeight = _.max(this.tickLabels.map((tick) => tick.height))
        const tickHeight = maxTickHeight ? maxTickHeight + tickPadding : 0
        return Math.max(tickHeight + labelOffset, this.config.minSize ?? 0)
    }

    @computed get size(): number {
        return this.height
    }

    @computed protected get baseTicks(): Tickmark[] {
        let ticks = this.getTickValues().filter(
            (tick): boolean => !tick.gridLineOnly
        )
        const { domain } = this

        // Make sure the start and end values are present, if they're whole numbers
        const startEndPrio = this.scaleType === ScaleType.log ? 2 : 1
        if (domain[0] % 1 === 0)
            ticks = [
                {
                    value: domain[0],
                    priority: startEndPrio,
                },
                ...ticks,
            ]
        if (domain[1] % 1 === 0 && this.hideFractionalTicks)
            ticks = [
                ...ticks,
                {
                    value: domain[1],
                    priority: startEndPrio,
                },
            ]

        // sort by value, then priority.
        // this way, we don't end up with two ticks of the same value but different priorities.
        // instead, we deduplicate by choosing the highest priority (i.e. lowest priority value).
        const sortedTicks = _.sortBy(ticks, [
            (t): number => t.value,
            (t): number => t.priority,
        ])
        return _.sortedUniqBy(sortedTicks, (t) => t.value)
    }

    @computed get tickLabels(): TickLabelPlacement[] {
        // Get ticks with coordinates, sorted by priority
        const tickLabels = _.sortBy(
            this.baseTicks,
            (tick) => tick.priority
        ).map((tick) => this.placeTickLabel(tick.value))
        const visibleTickLabels = hideOverlappingTickLabels(tickLabels, {
            padding: 3,
        })
        return visibleTickLabels
    }

    placeTickLabel(value: number): TickLabelPlacement {
        const formattedValue = this.formatTick(value)
        const { width, height } = Bounds.forText(formattedValue, {
            fontSize: this.tickFontSize,
        })
        let x = this.place(value)
        let xAlign = HorizontalAlign.center
        const left = x - width / 2
        const right = x + width / 2
        const offset = this.bandWidth ? this.bandWidth / 2 + OUTER_PADDING : 0
        if (left < this.rangeMin - offset) {
            x = this.rangeMin
            xAlign = HorizontalAlign.left
        }
        if (right > this.rangeMax + offset) {
            x = this.rangeMax
            xAlign = HorizontalAlign.right
        }
        return {
            value,
            formattedValue,
            x,
            y: 0,
            width,
            height,
            xAlign,
            isHidden: false,
        }
    }

    // Add some padding before checking for intersection
    protected doIntersect(bounds: Bounds, bounds2: Bounds): boolean {
        return bounds.intersects(bounds2.padWidth(-5))
    }
}

export class VerticalAxis extends AbstractAxis {
    clone(): VerticalAxis {
        return new VerticalAxis(this.config, this.axisManager)._update(this)
    }

    @computed get orient(): Position {
        return Position.left
    }

    @computed get labelMaxWidth(): number {
        // if rotated and positioned to the left of the axis,
        // the label width is limited by the height of the axis
        if (this.labelPosition === AxisAlign.middle) return this.height

        return this.axisManager?.axisBounds?.width ?? Infinity
    }

    @computed get labelOffsetLeft(): number {
        return this.labelPosition === AxisAlign.middle ? this.labelHeight : 0
    }

    @computed get labelOffsetTop(): number {
        return this.labelPosition === AxisAlign.middle ? 0 : this.labelHeight
    }

    // note that we intentionally don't take `hideAxisLabels` into account here.
    // tick labels might be hidden in faceted charts. when faceted, it's important
    // the axis size doesn't change as a result of hiding the axis labels, or else
    // we might end up with misaligned axes.
    @computed get width(): number {
        if (this.hideAxis) return 0
        const { tickPadding, labelOffsetLeft } = this
        const maxTickWidth = _.max(this.tickLabels.map((tick) => tick.width))
        const tickWidth =
            maxTickWidth !== undefined ? maxTickWidth + tickPadding : 0
        return Math.max(tickWidth + labelOffsetLeft, this.config.minSize ?? 0)
    }

    @computed get height(): number {
        return this.rangeSize
    }

    @computed get size(): number {
        return this.width
    }

    @computed get tickLabels(): TickLabelPlacement[] {
        const { domain } = this

        const tickLabels = _.sortBy(
            this.baseTicks,
            (tick) => tick.priority
        ).map((tick) => this.placeTickLabel(tick.value))

        // hide overlapping ticks, and allow for some padding
        let visibleTicks = hideOverlappingTickLabels(tickLabels, { padding: 3 })

        // if we end up with too few ticks, try again with less padding
        if (visibleTicks.length < this.minTicks) {
            visibleTicks = hideOverlappingTickLabels(tickLabels, { padding: 1 })
        }

        // if we still have too few ticks, de-prioritize the zero tick
        // if it's a start or end value and drawn as a solid line
        if (visibleTicks.length < this.minTicks) {
            const updatedBaseTicks = _.cloneDeep(this.baseTicks)
            if (domain[0] === 0 || domain[1] === 0) {
                const zeroIndex = updatedBaseTicks
                    .map((tick) => tick.value)
                    .indexOf(0)
                if (zeroIndex >= 0 && updatedBaseTicks[zeroIndex].solid) {
                    updatedBaseTicks[zeroIndex] = {
                        value: 0,
                        priority: 3,
                    }
                }
            }

            const tickLabels = _.sortBy(
                updatedBaseTicks,
                (tick) => tick.priority
            ).map((tick) => this.placeTickLabel(tick.value))
            visibleTicks = hideOverlappingTickLabels(tickLabels, { padding: 1 })
        }

        return visibleTicks
    }

    placeTickLabel(value: number): TickLabelPlacement {
        const formattedValue = this.formatTick(value)
        const { width, height } = Bounds.forText(formattedValue, {
            fontSize: this.tickFontSize,
        })
        const y = this.place(value)
        return {
            value,
            formattedValue,
            x: 0,
            y,
            width,
            height,
            xAlign: HorizontalAlign.right,
            yAlign: VerticalAlign.middle,
            isHidden: false,
        }
    }
}

interface DualAxisProps {
    bounds?: Bounds
    horizontalAxis: HorizontalAxis
    verticalAxis: VerticalAxis
}

// DualAxis has the important task of coordinating two axes so that they work together!
// There is a *two-way dependency* between the bounding size of each axis.
// e.g. if the y axis becomes wider because a label is present, the x axis then has less
// space to work with, and vice versa
export class DualAxis {
    private props: DualAxisProps
    constructor(props: DualAxisProps) {
        this.props = props
    }

    @computed get horizontalAxis(): HorizontalAxis {
        const axis = this.props.horizontalAxis.clone()
        axis.range = this.innerBounds.xRange()
        return axis
    }

    @computed get verticalAxis(): VerticalAxis {
        const axis = this.props.verticalAxis.clone()
        axis.range = this.innerBounds.yRange()
        return axis
    }

    // We calculate an initial height from the range of the input bounds
    @computed private get horizontalAxisSize(): number {
        const axis = this.props.horizontalAxis.clone()
        axis.range = [0, this.bounds.width]
        return axis.size
    }

    // We calculate an initial width from the range of the input bounds
    @computed private get verticalAxisSize(): number {
        const axis = this.props.verticalAxis.clone()
        axis.range = [0, this.bounds.height]
        return axis.size
    }

    // Now we can determine the "true" inner bounds of the dual axis
    @computed get innerBounds(): Bounds {
        return (
            this.bounds
                // add padding to account for the width of the vertical axis
                // and the height of the horizontal axis
                .pad({
                    [this.props.horizontalAxis.orient]: this.horizontalAxisSize,
                    [this.props.verticalAxis.orient]: this.verticalAxisSize,
                })
                // make space for the y-axis label if plotted above the axis
                .padTop(this.props.verticalAxis.labelOffsetTop)
        )
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }
}

function hideOverlappingTickLabels(
    tickLabels: TickLabelPlacement[],
    { padding = 0 }: { padding?: number } = {}
): TickLabelPlacement[] {
    for (let i = 0; i < tickLabels.length; i++) {
        for (let j = i + 1; j < tickLabels.length; j++) {
            const t1 = tickLabels[i],
                t2 = tickLabels[j]
            if (t1 === t2 || t1.isHidden || t2.isHidden) continue
            if (
                doIntersect(
                    // Expand bounds so that labels aren't too close together.
                    boundsFromLabelPlacement(t1).expand(padding),
                    boundsFromLabelPlacement(t2).expand(padding)
                )
            )
                t2.isHidden = true
        }
    }
    return tickLabels.filter((tick) => !tick.isHidden)
}
