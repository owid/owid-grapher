import React from "react"
import * as _ from "lodash-es"
import { computed, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { ChartInterface } from "../chart/ChartInterface"
import { MarimekkoChartState } from "./MarimekkoChartState"
import { type MarimekkoChartProps } from "./MarimekkoChart.js"
import {
    Bar,
    BAR_COLOR_ACTIVE,
    Item,
    MarimekkoChartManager,
    PlacedItem,
} from "./MarimekkoChartConstants"
import { Bounds } from "@ourworldindata/utils"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { AxisConfig } from "../axis/AxisConfig"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
    GRAPHER_FONT_SCALE_14,
} from "../core/GrapherConstants"
import { MarimekkoBars } from "./MarimekkoBars"
import { DualAxisComponent } from "../axis/AxisViews"
import { Halo } from "@ourworldindata/components"
import { toHorizontalAxis, toVerticalAxis } from "./MarimekkoChartHelpers"

const LABEL_PADDING = 4

@observer
export class MarimekkoChartThumbnail
    extends React.Component<MarimekkoChartProps>
    implements ChartInterface
{
    constructor(props: MarimekkoChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed get chartState(): MarimekkoChartState {
        return this.props.chartState
    }

    @computed get manager(): MarimekkoChartManager {
        return this.chartState.manager
    }

    @computed get bounds(): Bounds {
        return this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS
    }

    @computed get innerBounds(): Bounds {
        return this.bounds.padTop(
            this.chartState.isFocusModeActive
                ? // without -6px it would be contained within paddinf
                  this.labelFontSize + LABEL_PADDING - 6
                : 0
        )
    }

    @computed get fontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get labelFontSize(): number {
        return Math.floor(GRAPHER_FONT_SCALE_14 * this.fontSize)
    }

    // dual axis start

    // TODO: refactor DualAxis

    @computed private get yAxisConfig(): AxisConfig {
        return new AxisConfig(
            {
                hideGridlines: true,
                ...this.manager.yAxisConfig,
            },
            this
        )
    }

    @computed private get xAxisConfig(): AxisConfig {
        const { xColumnSlug } = this.chartState
        return new AxisConfig(
            {
                ...this.manager.xAxisConfig,
                // orient: Position.top,
                labelPadding: 2,
                hideAxis: xColumnSlug === undefined,
                hideGridlines: true,
            },
            this
        )
    }

    @computed private get verticalAxisPart(): VerticalAxis {
        return toVerticalAxis(this.yAxisConfig, this.chartState)
    }

    @computed private get horizontalAxisPart(): HorizontalAxis {
        return toHorizontalAxis(this.xAxisConfig, this.chartState)
    }

    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.innerBounds,
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    // dual axis end

    @computed get items(): Item[] {
        return this.chartState.items
    }

    @computed get placedItems(): PlacedItem[] {
        const { dualAxis } = this
        const { x0, sortedItems } = this.chartState
        const placedItems: PlacedItem[] = []
        let currentX = 0
        for (const item of sortedItems) {
            placedItems.push({ ...item, xPosition: currentX })
            const xValue = item.xPoint?.value ?? 1 // one is the default here because if no x dim is given we make all bars the same width
            const preciseX =
                dualAxis.horizontalAxis.place(xValue) -
                dualAxis.horizontalAxis.place(x0)
            currentX += preciseX
        }
        return placedItems
    }

    override render(): React.ReactElement {
        return (
            <g>
                {/* <rect {...this.bounds.toProps()} fill="green" /> */}
                {/* <rect {...this.dualAxis.innerBounds.toProps()} fill="gold" /> */}
                <DualAxisComponent
                    dualAxis={this.dualAxis}
                    onlyShowMinMaxLabels
                />
                <MarimekkoBars
                    dualAxis={this.dualAxis}
                    placedItems={this.placedItems}
                    fontSize={this.fontSize}
                    x0={this.chartState.x0}
                    y0={this.chartState.y0}
                    selectionArray={this.chartState.selectionArray}
                    selectedItems={this.chartState.selectedItems}
                    isFocusModeActive={this.chartState.isFocusModeActive}
                />
                <MarimekkoLabels
                    items={this.chartState.focusArray.seriesNames
                        .map((entityName) => {
                            const placedItem = this.placedItems.find(
                                (item) => item.entityName === entityName
                            )
                            return placedItem
                        })
                        .filter((item) => item !== undefined)}
                    dualAxis={this.dualAxis}
                    x0={this.chartState.x0}
                    y0={this.chartState.y0}
                    fontSize={Math.floor(GRAPHER_FONT_SCALE_14 * this.fontSize)}
                />
            </g>
        )
    }
}

function MarimekkoLabels({
    items,
    dualAxis,
    x0,
    y0,
    fontSize,
}: {
    items: PlacedItem[]
    dualAxis: DualAxis
    x0: number
    y0: number
    fontSize: number
}): React.ReactElement | null {
    const sortedItems = _.sortBy(
        items,
        (item) => item.xPoint?.value ?? item.xPosition
    )

    const placedLabels = sortedItems
        .map((item) => {
            const bar: Bar | undefined = item.bars[0]
            if (bar === undefined) return undefined

            const x = dualAxis.horizontalAxis.place(x0) + item.xPosition

            const _y =
                bar === undefined
                    ? dualAxis.verticalAxis.place(y0) -
                      (Bounds.forText("no data").height + 10)
                    : dualAxis.verticalAxis.place(bar.yPoint.value)
            const y = _y - LABEL_PADDING

            const label = item.entityName // todo: short entity name
            const bounds = Bounds.forText(label, { fontSize }).set({ x, y })

            const color = BAR_COLOR_ACTIVE
            // const color =
            //     item.entityColor?.color ??
            //     (bar.kind === BarShape.Bar ? bar.color : "#555")

            // Hide label if it doesn't fit within the chart area
            const isHidden = bounds.x + bounds.width > dualAxis.bounds.right

            return { bounds, label, color, isHidden }
        })
        .filter((label) => label !== undefined)

    for (let i = 0; i < placedLabels.length; i++) {
        const s1 = placedLabels[i]
        if (s1.isHidden) continue

        for (let j = i + 1; j < placedLabels.length; j++) {
            const s2 = placedLabels[j]
            if (s2.isHidden) continue

            if (s1.bounds.intersects(s2.bounds)) {
                s2.isHidden = true
            }
        }
    }

    const visibleLabels = placedLabels.filter((label) => !label.isHidden)

    if (!visibleLabels.length) return null

    return (
        <g>
            {visibleLabels.map(({ label, bounds, color }) => (
                <Halo key={label} id={label} outlineWidth={2}>
                    <text
                        x={bounds.x}
                        y={bounds.y}
                        fontSize={fontSize}
                        fill={color}
                    >
                        {label}
                    </text>
                </Halo>
            ))}
        </g>
    )
}
