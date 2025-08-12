import React from "react"
import { observer } from "mobx-react"
import { computed, makeObservable } from "mobx"
import {
    Bounds,
    GRAPHER_MAP_TYPE,
    GrapherChartOrMapType,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { DataTable } from "../dataTable/DataTable"
import { CaptionedChartManager } from "../captionedChart/CaptionedChart"
import { LoadingIndicator } from "@ourworldindata/components"
import { FacetChart } from "../facetChart/FacetChart"
import { getChartSvgProps, NoDataPattern } from "./ChartUtils"
import { ChartComponent, makeChartState } from "./ChartTypeMap"
import { GRAPHER_CHART_AREA_CLASS } from "../core/GrapherConstants"
import { ChartState } from "./ChartInterface"

interface ChartAreaContentProps {
    manager: CaptionedChartManager
    bounds: Bounds
    padWidth?: number
}

@observer
export class ChartAreaContent extends React.Component<ChartAreaContentProps> {
    constructor(props: ChartAreaContentProps) {
        super(props)
        makeObservable(this)
    }

    @computed private get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed private get bounds(): Bounds {
        return this.props.bounds.padWidth(this.props.padWidth ?? 0)
    }

    @computed private get activeChartOrMapType():
        | GrapherChartOrMapType
        | undefined {
        const { manager } = this
        if (manager.isOnTableTab) return undefined
        if (manager.isOnMapTab) return GRAPHER_MAP_TYPE
        if (manager.isOnChartTab) return manager.activeChartType
        return undefined
    }

    private renderNoDataPattern(): React.ReactElement {
        return (
            <defs>
                <NoDataPattern />
            </defs>
        )
    }

    @computed private get chartState(): ChartState | undefined {
        if (!this.activeChartOrMapType) return undefined
        return makeChartState(this.activeChartOrMapType, this.manager)
    }

    private renderLoadingIndicatorIntoSvg(): React.ReactElement {
        return (
            <foreignObject {...this.bounds.toProps()}>
                <LoadingIndicator title={this.manager.whatAreWeWaitingFor} />
            </foreignObject>
        )
    }

    private renderReadyChartOrMap(): React.ReactElement | null {
        const { bounds, manager, activeChartOrMapType, chartState } = this

        if (!activeChartOrMapType) return null

        // Todo: make FacetChart a chart type name?
        const activeChartType =
            activeChartOrMapType !== GRAPHER_MAP_TYPE
                ? activeChartOrMapType
                : undefined
        if (manager.isFaceted && activeChartType)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={activeChartType}
                    manager={manager}
                />
            )

        if (!chartState) return null

        return (
            <ChartComponent
                manager={manager}
                chartType={activeChartOrMapType}
                chartState={chartState}
                variant={manager.variant}
                bounds={bounds}
            />
        )
    }

    private renderChartOrMap(): React.ReactElement {
        const { width, height } = this.props.bounds

        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
            height,
        }

        return (
            <div style={containerStyle}>
                <svg
                    {...getChartSvgProps(this.manager)}
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                >
                    {this.renderNoDataPattern()}
                    {this.manager.isReady
                        ? this.renderReadyChartOrMap()
                        : this.renderLoadingIndicatorIntoSvg()}
                </svg>
            </div>
        )
    }

    private renderDataTable(): React.ReactElement {
        const { bounds } = this
        const containerStyle: React.CSSProperties = {
            position: "relative",
            ...bounds.toCSS(),
        }
        return (
            <div className="DataTableContainer" style={containerStyle}>
                {this.manager.isReady ? (
                    <DataTable bounds={bounds} manager={this.manager} />
                ) : (
                    <LoadingIndicator
                        title={this.manager.whatAreWeWaitingFor}
                    />
                )}
            </div>
        )
    }

    renderStatic(): React.ReactElement | null {
        // We cannot render a table to svg, but would rather display nothing at all to avoid issues.
        // See https://github.com/owid/owid-grapher/issues/3283
        if (this.manager.isOnTableTab) return null

        return (
            <g
                id={makeIdForHumanConsumption(GRAPHER_CHART_AREA_CLASS)}
                style={{ pointerEvents: "none" }}
            >
                {this.renderReadyChartOrMap()}
            </g>
        )
    }

    renderInteractive(): React.ReactElement | null {
        return this.manager.isOnTableTab
            ? this.renderDataTable()
            : this.renderChartOrMap()
    }

    override render(): React.ReactElement | null {
        return this.manager.isStatic
            ? this.renderStatic()
            : this.renderInteractive()
    }
}
