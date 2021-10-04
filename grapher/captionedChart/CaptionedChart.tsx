import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { Bounds, DEFAULT_BOUNDS } from "../../clientUtils/Bounds"
import { Header } from "../header/Header"
import { Footer } from "../footer/Footer"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    FacetStrategy,
    GrapherTabOption,
} from "../core/GrapherConstants"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { ChartManager } from "../chart/ChartManager"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FacetChart } from "../facetChart/FacetChart"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { CollapsibleList } from "../controls/CollapsibleList/CollapsibleList"
import {
    ZoomToggle,
    AbsRelToggle,
    HighlightToggle,
    FilterSmallCountriesToggle,
    SmallCountriesFilterManager,
    AbsRelToggleManager,
    HighlightToggleManager,
    FacetYDomainToggle,
    FacetYDomainToggleManager,
    FacetStrategyDropdown,
    FacetStrategyDropdownManager,
    NoDataAreaToggle,
} from "../controls/Controls"
import { ScaleSelector } from "../controls/ScaleSelector"
import { AddEntityButton } from "../controls/AddEntityButton"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { FooterManager } from "../footer/FooterManager"
import { HeaderManager } from "../header/HeaderManager"
import { exposeInstanceOnWindow } from "../../clientUtils/Util"
import { SelectionArray } from "../selection/SelectionArray"
import { EntityName } from "../../coreTable/OwidTableConstants"
import { AxisConfig } from "../axis/AxisConfig"

export interface CaptionedChartManager
    extends ChartManager,
        MapChartManager,
        SmallCountriesFilterManager,
        HighlightToggleManager,
        AbsRelToggleManager,
        FooterManager,
        HeaderManager,
        FacetYDomainToggleManager,
        FacetStrategyDropdownManager {
    containerElement?: HTMLDivElement
    tabBounds?: Bounds
    fontSize?: number
    tab?: GrapherTabOption
    type?: ChartTypeName
    yAxis?: AxisConfig
    xAxis?: AxisConfig
    typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart?: ChartTypeName
    isReady?: boolean
    whatAreWeWaitingFor?: string
    entityType?: string
    entityTypePlural?: string
    showSmallCountriesFilterToggle?: boolean
    showYScaleToggle?: boolean
    showXScaleToggle?: boolean
    showZoomToggle?: boolean
    showAbsRelToggle?: boolean
    showNoDataAreaToggle?: boolean
    showFacetYDomainToggle?: boolean
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

@observer
export class CaptionedChart extends React.Component<CaptionedChartProps> {
    @computed protected get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed private get containerElement(): HTMLDivElement | undefined {
        return this.manager?.containerElement
    }

    @computed private get maxWidth(): number {
        return this.props.maxWidth ?? this.bounds.width - OUTSIDE_PADDING * 2
    }

    @computed protected get header(): Header {
        return new Header({
            manager: this.manager,
            maxWidth: this.maxWidth,
        })
    }

    @computed protected get footer(): Footer {
        return new Footer({
            manager: this.manager,
            maxWidth: this.maxWidth,
        })
    }

    @computed protected get chartHeight(): number {
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
    @computed protected get isMapTab(): boolean {
        return this.manager.tab === GrapherTabOption.map
    }

    @computed protected get bounds(): Bounds {
        return this.props.bounds ?? this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart(): Bounds {
        const topPadding = this.isMapTab
            ? 0
            : this.manager.type === ChartTypeName.Marimekko
            ? PADDING_BELOW_HEADER / 2
            : PADDING_BELOW_HEADER
        return new Bounds(0, 0, this.bounds.width, this.chartHeight)
            .padWidth(OUTSIDE_PADDING)
            .padTop(topPadding)
            .padBottom(OUTSIDE_PADDING)
    }

    @computed get isFaceted(): boolean {
        const hasStrategy =
            !!this.manager.facetStrategy &&
            this.manager.facetStrategy !== FacetStrategy.none
        return !this.isMapTab && hasStrategy
    }

    renderChart(): JSX.Element {
        const { manager } = this
        const bounds = this.boundsForChart

        const chartTypeName = this.isMapTab
            ? ChartTypeName.WorldMap
            : manager.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart ??
              manager.type ??
              ChartTypeName.LineChart
        const ChartClass =
            ChartComponentClassMap.get(chartTypeName) ?? DefaultChartClass

        // Todo: make FacetChart a chart type name?
        if (this.isFaceted)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={chartTypeName}
                    manager={manager}
                />
            )

        return (
            <ChartClass
                bounds={bounds}
                manager={manager}
                containerElement={this.containerElement}
            />
        )
    }

    componentDidMount(): void {
        exposeInstanceOnWindow(this, "captionedChart")
    }

    @action.bound startSelecting(): void {
        this.manager.isSelectingData = true
    }

    @computed get controls(): JSX.Element[] {
        const manager = this.manager
        // Todo: we don't yet show any controls on Maps, but seems like we would want to.
        if (!manager.isReady || this.isMapTab) return []

        const { showYScaleToggle, showXScaleToggle } = manager

        const controls: JSX.Element[] = []

        if (showYScaleToggle)
            controls.push(
                <ScaleSelector
                    key="scaleSelector"
                    manager={manager.yAxis!}
                    prefix={showXScaleToggle ? "Y: " : ""}
                />
            )

        if (showXScaleToggle)
            controls.push(
                <ScaleSelector
                    key="scaleSelector"
                    manager={manager.xAxis!}
                    prefix={"X: "}
                />
            )

        if (manager.showSelectEntitiesButton)
            controls.push(
                <button
                    type="button"
                    key="grapher-select-entities"
                    data-track-note="grapher-select-entities"
                    style={controls.length === 0 ? { padding: 0 } : {}} // If there are no controls to the left then set padding to 0 for better alignment
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

        if (
            !manager.hideFacetControl &&
            manager.availableFacetStrategies.length > 1
        ) {
            controls.push(
                <FacetStrategyDropdown
                    key="FacetStrategyDropdown"
                    manager={manager}
                />
            )
        }

        if (manager.showAbsRelToggle)
            controls.push(<AbsRelToggle key="AbsRelToggle" manager={manager} />)

        if (manager.showNoDataAreaToggle)
            controls.push(
                <NoDataAreaToggle key="NoDataAreaToggle" manager={manager} />
            )

        if (manager.showFacetYDomainToggle)
            controls.push(
                <FacetYDomainToggle
                    key="FacetYDomainToggle"
                    manager={manager}
                />
            )

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

    @computed get selectionArray(): SelectionArray | EntityName[] | undefined {
        return this.manager.selection
    }

    private renderControlsRow(): JSX.Element | null {
        return this.controls.length ? (
            <div className="controlsRow">
                <CollapsibleList>{this.controls}</CollapsibleList>
            </div>
        ) : null
    }

    private renderLoadingIndicator(): JSX.Element {
        return (
            <foreignObject {...this.boundsForChart.toProps()}>
                <LoadingIndicator title={this.manager.whatAreWeWaitingFor} />
            </foreignObject>
        )
    }

    render(): JSX.Element {
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

    @computed protected get svgProps(): React.SVGProps<SVGSVGElement> {
        return {
            xmlns: "http://www.w3.org/2000/svg",
            version: "1.1",
            style: {
                fontFamily:
                    "Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif",
                fontSize: this.manager.fontSize ?? BASE_FONT_SIZE,
                backgroundColor: "white",
                textRendering: "geometricPrecision",
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

    @computed private get paddedBounds(): Bounds {
        return this.bounds.pad(OUTSIDE_PADDING)
    }

    // The bounds for the middle chart part
    @computed protected get boundsForChart(): Bounds {
        return this.paddedBounds
            .padTop(this.header.height)
            .padBottom(this.footer.height + PADDING_ABOVE_FOOTER)
            .padTop(this.isMapTab ? 0 : PADDING_BELOW_HEADER)
    }

    render(): JSX.Element {
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
