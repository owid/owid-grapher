import * as _ from "lodash-es"
import React from "react"
import * as R from "remeda"
import {
    Bounds,
    Time,
    HorizontalAlign,
    EntityName,
    getRelativeMouse,
    exposeInstanceOnWindow,
} from "@ourworldindata/utils"
import { action, computed, makeObservable, observable } from "mobx"
import { observer } from "mobx-react"
import { SeriesName } from "@ourworldindata/types"
import {
    BASE_FONT_SIZE,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { NoDataModal } from "../noDataModal/NoDataModal"
import { ChartInterface } from "../chart/ChartInterface"
import { ChartManager } from "../chart/ChartManager"
import { TooltipState } from "../tooltip/Tooltip"
import { StackedSeries } from "./StackedConstants"
import {
    HorizontalCategoricalColorLegend,
    HorizontalColorLegendManager,
} from "../horizontalColorLegend/HorizontalColorLegends"
import { CategoricalBin, ColorScaleBin } from "../color/ColorScaleBin"
import { StackedDiscreteBarChartState } from "./StackedDiscreteBarChartState"
import { ChartComponentProps } from "../chart/ChartTypeMap.js"
import { StackedDiscreteBars } from "./StackedDiscreteBars"

export interface StackedDiscreteBarChartManager extends ChartManager {
    endTime?: Time
    hideTotalValueLabel?: boolean
}

type StackedDiscreteBarChartProps =
    ChartComponentProps<StackedDiscreteBarChartState>

@observer
export class StackedDiscreteBarChart
    extends React.Component<StackedDiscreteBarChartProps>
    implements ChartInterface, HorizontalColorLegendManager
{
    base = React.createRef<SVGGElement>()

    constructor(props: StackedDiscreteBarChartProps) {
        super(props)

        makeObservable(this, {
            focusSeriesName: observable,
            tooltipState: observable,
        })
    }

    focusSeriesName: SeriesName | undefined = undefined

    @computed get chartState(): StackedDiscreteBarChartState {
        return this.props.chartState
    }

    @computed private get manager(): StackedDiscreteBarChartManager {
        return this.chartState.manager
    }

    @computed private get bounds(): Bounds {
        // bottom padding avoids axis labels to be cut off at some resolutions
        return (this.props.bounds ?? DEFAULT_GRAPHER_BOUNDS)
            .padRight(10)
            .padBottom(2)
    }

    @computed private get baseFontSize(): number {
        return this.manager.fontSize ?? BASE_FONT_SIZE
    }

    @computed get isStatic(): boolean {
        return this.manager.isStatic ?? false
    }

    @computed private get showLegend(): boolean {
        return (
            !!this.manager.showLegend &&
            !this.manager.isDisplayedAlongsideComplementaryTable
        )
    }

    @computed private get boundsWithoutLegend(): Bounds {
        return this.bounds.padTop(
            this.showLegend && this.legend.height > 0
                ? this.legend.height + this.legendPaddingTop
                : 0
        )
    }

    // legend props

    @computed private get legendPaddingTop(): number {
        return 0.5 * this.baseFontSize
    }

    @computed get legendX(): number {
        return this.bounds.x
    }

    @computed get categoryLegendY(): number {
        return this.bounds.top
    }

    @computed get legendWidth(): number {
        return this.bounds.width
    }

    @computed get legendAlign(): HorizontalAlign {
        return HorizontalAlign.left
    }

    @computed get fontSize(): number {
        return this.baseFontSize
    }

    @computed private get legendBins(): CategoricalBin[] {
        return this.series.map((series, index) => {
            return new CategoricalBin({
                index,
                value: series.seriesName,
                label: series.seriesName,
                color: series.color,
            })
        })
    }

    @computed get categoricalLegendData(): CategoricalBin[] {
        return this.showLegend ? this.legendBins : []
    }

    @computed get externalLegend(): HorizontalColorLegendManager | undefined {
        if (!this.showLegend) {
            return {
                categoricalLegendData: this.legendBins,
            }
        }
        return undefined
    }

    @action.bound onLegendMouseOver(bin: ColorScaleBin): void {
        this.focusSeriesName = R.first(
            this.series
                .map((s) => s.seriesName)
                .filter((name) => bin.contains(name))
        )
    }

    @action.bound onLegendMouseLeave(): void {
        this.focusSeriesName = undefined
    }

    @computed private get legend(): HorizontalCategoricalColorLegend {
        return new HorizontalCategoricalColorLegend({ manager: this })
    }

    tooltipState = new TooltipState<{
        entityName: string
        seriesName?: string
    }>()

    @action.bound private onMouseMove(ev: React.MouseEvent): void {
        const ref = this.manager.base?.current
        if (ref) {
            this.tooltipState.position = getRelativeMouse(ref, ev)
        }
    }

    override render(): React.ReactElement {
        if (this.chartState.errorInfo.reason)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.bounds}
                    message={this.chartState.errorInfo.reason}
                />
            )

        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }

    private renderLegend(): React.ReactElement | undefined {
        if (!this.showLegend) return
        return <HorizontalCategoricalColorLegend manager={this} />
    }

    private renderStatic(): React.ReactElement {
        return (
            <>
                {this.renderLegend()}
                <StackedDiscreteBars
                    chartState={this.chartState}
                    bounds={this.boundsWithoutLegend}
                    tooltipState={this.tooltipState}
                    focusSeriesName={this.focusSeriesName}
                />
            </>
        )
    }

    private renderInteractive(): React.ReactElement {
        const { bounds } = this

        // needs to be referenced here, otherwise it's not updated in the renderRow function
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        this.focusSeriesName

        return (
            <g
                ref={this.base}
                className="StackedDiscreteBarChart"
                onMouseMove={this.onMouseMove}
            >
                <rect
                    x={bounds.left}
                    y={bounds.top}
                    width={bounds.width}
                    height={bounds.height}
                    opacity={0}
                    fill="rgba(255,255,255,0)"
                />
                {this.renderLegend()}
                <StackedDiscreteBars
                    chartState={this.chartState}
                    bounds={this.boundsWithoutLegend}
                    tooltipState={this.tooltipState}
                    focusSeriesName={this.focusSeriesName}
                />
            </g>
        )
    }

    @computed private get series(): readonly StackedSeries<EntityName>[] {
        return this.chartState.series
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this)
    }
}
