import * as React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { Header } from "grapher/header/Header"
import { Footer } from "grapher/footer/Footer"
import { getChartComponent } from "grapher/chart/ChartTypeMap"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { MapChartManager } from "grapher/mapCharts/MapChartConstants"
import { ChartManager } from "grapher/chart/ChartManager"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"
import { FacetChart } from "grapher/facetChart/FacetChart"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CollapsibleList } from "grapher/controls/CollapsibleList/CollapsibleList"
import {
    ZoomToggle,
    AbsRelToggle,
    HighlightToggle,
    FilterSmallCountriesToggle,
    SmallCountriesFilterManager,
    AbsRelToggleManager,
    HighlightToggleManager,
} from "grapher/controls/Controls"
import { ScaleSelector } from "grapher/controls/ScaleSelector"
import { AddEntityButton } from "grapher/controls/AddEntityButton"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FooterManager } from "grapher/footer/FooterManager"
import { HeaderManager } from "grapher/header/HeaderManager"

export interface CaptionedChartManager
    extends ChartManager,
        MapChartManager,
        SmallCountriesFilterManager,
        HighlightToggleManager,
        AbsRelToggleManager,
        FooterManager,
        HeaderManager {
    containerElement?: HTMLDivElement
    tabBounds?: Bounds
    fontSize?: number
    tab?: GrapherTabOption
    type?: ChartTypeName
    constrainedType?: ChartTypeName
    isSingleTime?: boolean // todo: remove?
    isReady?: boolean
    isStaticSvg?: boolean
    entityType?: string
    entityTypePlural?: string
    showSmallCountriesFilterToggle?: boolean
    showYScaleToggle?: boolean
    showZoomToggle?: boolean
    showAbsRelToggle?: boolean
    showHighlightToggle?: boolean
    showChangeEntityButton?: boolean
    showAddEntityButton?: boolean
    showSelectEntitiesButton?: boolean
}

const ControlsRowHeight = 36

interface CaptionedChartProps {
    manager: CaptionedChartManager
    bounds?: Bounds
}

@observer
export class CaptionedChart extends React.Component<CaptionedChartProps> {
    @computed protected get manager() {
        return this.props.manager
    }

    @computed private get containerElement() {
        return this.manager?.containerElement
    }

    @computed protected get header() {
        return new Header({ manager: this.manager })
    }

    @computed protected get footer() {
        return new Footer({ manager: this.manager })
    }

    @computed protected get chartHeight() {
        const controlsRowHeight = this.controls.length ? ControlsRowHeight : 0
        const someRandomConstant = 25 // todo: what is this?
        return (
            this.bounds.height -
            this.header.height -
            controlsRowHeight -
            this.footer.height -
            someRandomConstant
        )
    }

    // todo: should we remove this and not make a distinction between map and chart tabs?
    @computed private get isMapTab() {
        return this.manager.tab === GrapherTabOption.map
    }

    @computed protected get bounds() {
        return this.props.bounds ?? this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart() {
        // Todo: what is the 15 width padding?
        const bounds = new Bounds(0, 0, this.bounds.width, this.chartHeight)
            .padWidth(15)
            .padTop(18) // todo: what is the 18 padding?
        if (this.manager.type === ChartTypeName.SlopeChart)
            return bounds.padBottom(15) // Todo: this should be in SlopeChart class.
        return bounds
    }

    renderChart() {
        const { manager } = this
        const bounds = this.boundsForChart

        const chartTypeName = this.isMapTab
            ? ChartTypeName.WorldMap
            : manager.constrainedType || manager.type || ChartTypeName.LineChart
        const ChartType = getChartComponent(chartTypeName) as any // todo: add typing

        // Todo: make FacetChart a chart type name?
        if (!this.isMapTab && manager.facetStrategy)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={chartTypeName}
                    manager={manager}
                />
            )

        return ChartType ? (
            <ChartType
                bounds={bounds}
                manager={manager}
                containerElement={this.containerElement}
            />
        ) : null
    }

    @computed get controls() {
        const manager = this.manager
        // Todo: we don't yet show any controls on Maps, but seems like we would want to.
        if (!manager.isReady || this.isMapTab) return []

        const controls: JSX.Element[] = []

        if (manager.showYScaleToggle)
            controls.push(
                <ScaleSelector
                    key="scaleSelector"
                    manager={manager.yAxis!.toVerticalAxis()}
                />
            )

        if (manager.showSelectEntitiesButton)
            controls.push(
                <button
                    type="button"
                    key="grapher-select-entities"
                    data-track-note="grapher-select-entities"
                >
                    <span className="SelectEntitiesButton">
                        <FontAwesomeIcon icon={faPencilAlt} />
                        {`Select ${manager.entityTypePlural}`}
                    </span>
                </button>
            )

        if (manager.showChangeEntityButton)
            controls.push(
                <button
                    type="button"
                    key="grapher-change-entities"
                    data-track-note="grapher-change-entity"
                    className="ChangeEntityButton"
                >
                    <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                    {manager.entityType}
                </button>
            )

        if (manager.showAddEntityButton)
            controls.push(
                <AddEntityButton key="AddEntityButton" manager={manager} />
            )

        if (manager.showZoomToggle)
            controls.push(<ZoomToggle key="ZoomToggle" manager={manager} />)

        if (manager.showAbsRelToggle)
            controls.push(<AbsRelToggle key="AbsRelToggle" manager={manager} />)

        if (manager.showHighlightToggle)
            controls.push(
                <HighlightToggle key="highlight-toggle" manager={manager} />
            )

        if (manager.showSmallCountriesFilterToggle)
            controls.push(
                <FilterSmallCountriesToggle
                    key="FilterSmallCountriesToggle"
                    manager={manager}
                />
            )

        return controls
    }

    private renderControlsRow() {
        return this.controls.length ? (
            <div className="controlsRow">
                <CollapsibleList>{this.controls}</CollapsibleList>
            </div>
        ) : null
    }

    private renderLoadingIndicator() {
        return (
            <foreignObject {...this.boundsForChart.toProps()}>
                <LoadingIndicator />
            </foreignObject>
        )
    }

    render() {
        const { bounds, chartHeight } = this
        const { width } = bounds

        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
        }

        return (
            <>
                <Header manager={this.manager} />
                {this.renderControlsRow()}
                <div style={containerStyle}>
                    <svg
                        {...this.svgProps}
                        width={width}
                        height={chartHeight}
                        viewBox={`0 0 ${width} ${chartHeight}`}
                    >
                        {this.manager.isReady
                            ? this.renderChart()
                            : this.renderLoadingIndicator()}
                    </svg>
                </div>
                <Footer manager={this.manager} />
            </>
        )
    }

    @computed protected get svgProps() {
        return {
            xmlns: "http://www.w3.org/2000/svg",
            version: "1.1",
            style: {
                fontFamily:
                    "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: this.manager.fontSize ?? BASE_FONT_SIZE,
                backgroundColor: "white",
                textRendering: "optimizeLegibility" as any,
                WebkitFontSmoothing: "antialiased",
            },
        }
    }
}

@observer
export class StaticCaptionedChart extends CaptionedChart {
    constructor(props: CaptionedChartProps) {
        super(props)
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart() {
        const bounds = this.bounds
            .padTop(this.header.height)
            .padBottom(this.footer.height)
            .padTop(18) // todo: what is the 18 padding?
        if (this.manager.type === ChartTypeName.SlopeChart)
            return bounds.padBottom(15) // Todo: this should be in SlopeChart class.
        return bounds
    }

    render() {
        const bounds = this.bounds
        const { width, height } = bounds

        return (
            <svg
                {...this.svgProps}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {this.header.renderStatic(bounds.x, bounds.y)}
                {this.renderChart()}
                {this.footer.renderStatic(
                    bounds.x,
                    bounds.bottom - this.footer.height
                )}
            </svg>
        )
    }
}
