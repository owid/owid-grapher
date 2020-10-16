import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { Header } from "grapher/header/Header"
import { Footer } from "grapher/footer/Footer"
import { getChartComponentClass } from "grapher/chart/ChartTypeMap"
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
import { exposeInstanceOnWindow } from "grapher/utils/Util"

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

interface CaptionedChartProps {
    manager: CaptionedChartManager
    bounds?: Bounds
    maxWidth?: number
}

const OUTSIDE_PADDING = 15
const PADDING_BELOW_HEADER = 18
const CONTROLS_ROW_HEIGHT = 36
const PADDING_ABOVE_FOOTER = 25
const EXTRA_PADDING_ABOVE_FOOTER_FOR_SLOPE_CHART = 15 // Todo: should this be in SlopeChart class?

@observer
export class CaptionedChart extends React.Component<CaptionedChartProps> {
    @computed protected get manager() {
        return this.props.manager
    }

    @computed private get containerElement() {
        return this.manager?.containerElement
    }

    @computed private get maxWidth() {
        return this.props.maxWidth ?? this.bounds.width - OUTSIDE_PADDING * 2
    }

    @computed protected get header() {
        return new Header({
            manager: this.manager,
            maxWidth: this.maxWidth,
        })
    }

    @computed protected get footer() {
        return new Footer({
            manager: this.manager,
            maxWidth: this.maxWidth,
        })
    }

    @computed protected get chartHeight() {
        const controlsRowHeight = this.controls.length ? CONTROLS_ROW_HEIGHT : 0
        return (
            this.bounds.height -
            this.header.height -
            controlsRowHeight -
            this.footer.height -
            PADDING_ABOVE_FOOTER
        )
    }

    // todo: should we remove this and not make a distinction between map and chart tabs?
    @computed protected get isMapTab() {
        return this.manager.tab === GrapherTabOption.map
    }

    @computed protected get bounds() {
        return this.props.bounds ?? this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart() {
        const paddingBelowHeader = this.isMapTab ? 0 : PADDING_BELOW_HEADER
        const bounds = new Bounds(0, 0, this.bounds.width, this.chartHeight)
            .padWidth(OUTSIDE_PADDING)
            .padTop(paddingBelowHeader)
            .padBottom(OUTSIDE_PADDING)
        if (this.manager.type === ChartTypeName.SlopeChart)
            return bounds.padBottom(EXTRA_PADDING_ABOVE_FOOTER_FOR_SLOPE_CHART)
        return bounds
    }

    renderChart() {
        const { manager } = this
        const bounds = this.boundsForChart

        const chartTypeName = this.isMapTab
            ? ChartTypeName.WorldMap
            : manager.constrainedType || manager.type || ChartTypeName.LineChart
        const ChartClass = getChartComponentClass(chartTypeName)

        // Todo: make FacetChart a chart type name?
        if (!this.isMapTab && manager.facetStrategy)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={chartTypeName}
                    manager={manager}
                />
            )

        return ChartClass ? (
            <ChartClass
                bounds={bounds}
                manager={manager}
                containerElement={this.containerElement}
            />
        ) : null
    }

    componentDidMount() {
        exposeInstanceOnWindow(this, "captionedChart")
    }

    @action.bound startSelecting() {
        this.manager.isSelectingData = true
    }

    @computed get controls() {
        const manager = this.manager
        // Todo: we don't yet show any controls on Maps, but seems like we would want to.
        if (!manager.isReady || this.isMapTab) return []

        const controls: JSX.Element[] = []

        if (manager.showYScaleToggle)
            controls.push(
                <ScaleSelector key="scaleSelector" manager={manager.yAxis!} />
            )

        if (manager.showSelectEntitiesButton)
            controls.push(
                <button
                    type="button"
                    key="grapher-select-entities"
                    data-track-note="grapher-select-entities"
                    onClick={this.startSelecting}
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
                    onClick={this.startSelecting}
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
        const { bounds, chartHeight, maxWidth } = this
        const { width } = bounds

        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
        }

        return (
            <>
                <Header manager={this.manager} maxWidth={maxWidth} />
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
                <Footer manager={this.manager} maxWidth={maxWidth} />
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

    @computed private get paddedBounds() {
        return this.bounds.pad(OUTSIDE_PADDING)
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart() {
        const paddingBelowHeader = this.isMapTab ? 0 : PADDING_BELOW_HEADER
        const bounds = this.paddedBounds
            .padTop(this.header.height)
            .padBottom(this.footer.height + PADDING_ABOVE_FOOTER)
            .padTop(paddingBelowHeader)
        if (this.manager.type === ChartTypeName.SlopeChart)
            return bounds.padBottom(EXTRA_PADDING_ABOVE_FOOTER_FOR_SLOPE_CHART)
        return bounds
    }

    render() {
        const { bounds, paddedBounds } = this
        const { width, height } = bounds

        return (
            <svg
                {...this.svgProps}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {this.header.renderStatic(paddedBounds.x, paddedBounds.y)}
                {this.renderChart()}
                {this.footer.renderStatic(
                    paddedBounds.x,
                    paddedBounds.bottom - this.footer.height
                )}
            </svg>
        )
    }
}
