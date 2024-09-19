import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    exposeInstanceOnWindow,
    isEmpty,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import { Header, StaticHeader } from "../header/Header"
import { Footer, StaticFooter } from "../footer/Footer"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import {
    BASE_FONT_SIZE,
    Patterns,
    STATIC_EXPORT_DETAIL_SPACING,
    DEFAULT_GRAPHER_FRAME_PADDING,
    GRAPHER_BACKGROUND_COLOR,
} from "../core/GrapherConstants"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { ChartManager } from "../chart/ChartManager"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FacetChart } from "../facetChart/FacetChart"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { FooterManager } from "../footer/FooterManager"
import { HeaderManager } from "../header/HeaderManager"
import { SelectionArray } from "../selection/SelectionArray"
import {
    EntityName,
    ChartTypeName,
    FacetStrategy,
    GrapherTabOption,
    RelatedQuestionsConfig,
} from "@ourworldindata/types"
import { DataTable, DataTableManager } from "../dataTable/DataTable"
import {
    TimelineComponent,
    TIMELINE_HEIGHT,
} from "../timeline/TimelineComponent"
import { TimelineController } from "../timeline/TimelineController"
import {
    ControlsRow,
    ControlsRowManager,
} from "../controls/controlsRow/ControlsRow"

export interface CaptionedChartManager
    extends ChartManager,
        MapChartManager,
        FooterManager,
        HeaderManager,
        DataTableManager,
        ControlsRowManager {
    containerElement?: HTMLDivElement
    bakedGrapherURL?: string
    isReady?: boolean
    whatAreWeWaitingFor?: string

    // bounds
    captionedChartBounds?: Bounds
    sidePanelBounds?: Bounds
    staticBounds?: Bounds
    staticBoundsWithDetails?: Bounds

    // layout
    isSmall?: boolean
    isMedium?: boolean
    framePaddingHorizontal?: number
    framePaddingVertical?: number
    fontSize?: number

    // state
    tab?: GrapherTabOption
    isOnMapTab?: boolean
    isOnTableTab?: boolean
    type: ChartTypeName
    typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart?: ChartTypeName
    showEntitySelectionToggle?: boolean

    // timeline
    hasTimeline?: boolean
    timelineController?: TimelineController

    // details on demand
    shouldIncludeDetailsInStaticExport?: boolean
    detailRenderers: MarkdownTextWrap[]

    // related question
    relatedQuestions?: RelatedQuestionsConfig[]
    showRelatedQuestion?: boolean
}

interface CaptionedChartProps {
    manager: CaptionedChartManager
    bounds?: Bounds
    maxWidth?: number
}

// keep in sync with sass variables in CaptionedChart.scss
const CONTROLS_ROW_HEIGHT = 32

@observer
export class CaptionedChart extends React.Component<CaptionedChartProps> {
    @computed protected get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed private get containerElement(): HTMLDivElement | undefined {
        return this.manager?.containerElement
    }

    @computed protected get maxWidth(): number {
        return (
            this.props.maxWidth ??
            this.bounds.width - 2 * this.framePaddingHorizontal
        )
    }

    @computed protected get framePaddingVertical(): number {
        return (
            this.manager.framePaddingVertical ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed protected get framePaddingHorizontal(): number {
        return (
            this.manager.framePaddingHorizontal ?? DEFAULT_GRAPHER_FRAME_PADDING
        )
    }

    @computed protected get verticalPadding(): number {
        return this.manager.isSmall ? 8 : this.manager.isMedium ? 12 : 16
    }

    @computed protected get verticalPaddingSmall(): number {
        if (this.manager.isOnMapTab) return 4
        return this.manager.isMedium ? 8 : 16
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

    protected get patterns(): React.ReactElement {
        return (
            <defs>
                <pattern
                    id={Patterns.noDataPattern}
                    key={Patterns.noDataPattern}
                    patternUnits="userSpaceOnUse"
                    width="4"
                    height="4"
                    patternTransform="rotate(-45 2 2)"
                >
                    <path d="M -1,2 l 6,0" stroke="#ccc" strokeWidth="0.7" />
                </pattern>
            </defs>
        )
    }

    @computed protected get bounds(): Bounds {
        const bounds =
            this.props.bounds ??
            this.manager.captionedChartBounds ??
            DEFAULT_BOUNDS
        // the padding ensures grapher's frame is not cut off
        return bounds.padRight(2).padBottom(2)
    }

    @computed protected get boundsForChartArea(): Bounds {
        const { bounds, chartHeight } = this
        return new Bounds(0, 0, bounds.width, chartHeight).padWidth(
            this.framePaddingHorizontal
        )
    }

    @computed get isFaceted(): boolean {
        const hasStrategy =
            !!this.manager.facetStrategy &&
            this.manager.facetStrategy !== FacetStrategy.none
        return !this.manager.isOnMapTab && hasStrategy
    }

    @computed get chartTypeName(): ChartTypeName {
        const { manager } = this
        return this.manager.isOnMapTab
            ? ChartTypeName.WorldMap
            : manager.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart ??
                  manager.type ??
                  ChartTypeName.LineChart
    }

    renderChart(): React.ReactElement {
        const { manager } = this
        const bounds = this.boundsForChartArea
        const ChartClass =
            ChartComponentClassMap.get(this.chartTypeName) ?? DefaultChartClass

        // Todo: make FacetChart a chart type name?
        if (this.isFaceted)
            return (
                <FacetChart
                    bounds={bounds}
                    chartTypeName={this.chartTypeName}
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

    @computed get selectionArray(): SelectionArray | EntityName[] | undefined {
        return this.manager.selection
    }

    @computed private get showRelatedQuestion(): boolean {
        return !!this.manager.showRelatedQuestion
    }

    @computed get relatedQuestionHeight(): number {
        if (!this.showRelatedQuestion) return 0
        return this.manager.isMedium ? 24 : 28
    }

    @computed private get showControlsRow(): boolean {
        return ControlsRow.shouldShow(this.manager)
    }

    private renderControlsRow(): React.ReactElement {
        return (
            <ControlsRow
                manager={this.manager}
                maxWidth={this.maxWidth}
                settingsMenuTop={
                    this.framePaddingVertical +
                    this.header.height +
                    this.verticalPadding +
                    CONTROLS_ROW_HEIGHT +
                    4 // margin between button and menu
                }
            />
        )
    }

    private renderRelatedQuestion(): React.ReactElement {
        const { relatedQuestions } = this.manager
        return (
            <div
                className="relatedQuestion"
                style={{
                    width: this.bounds.width,
                    height: this.relatedQuestionHeight,
                    padding: `0 ${this.framePaddingHorizontal}px`,
                }}
            >
                Related:&nbsp;
                <a
                    href={relatedQuestions![0].url}
                    target="_blank"
                    rel="noopener"
                    data-track-note="chart_click_related"
                >
                    {relatedQuestions![0].text}
                </a>
                <FontAwesomeIcon icon={faExternalLinkAlt} />
            </div>
        )
    }

    private renderLoadingIndicator(): React.ReactElement {
        return (
            <foreignObject {...this.boundsForChartArea.toProps()}>
                <LoadingIndicator title={this.manager.whatAreWeWaitingFor} />
            </foreignObject>
        )
    }

    private renderDataTable(): React.ReactElement {
        const { boundsForChartArea } = this
        const containerStyle: React.CSSProperties = {
            position: "relative",
            ...this.boundsForChartArea.toCSS(),
        }
        return (
            <div className="DataTableContainer" style={containerStyle}>
                {this.manager.isReady ? (
                    <DataTable
                        bounds={boundsForChartArea}
                        manager={this.manager}
                    />
                ) : (
                    <LoadingIndicator
                        title={this.manager.whatAreWeWaitingFor}
                    />
                )}
            </div>
        )
    }

    private renderChartOrMap(): React.ReactElement {
        const { bounds, chartHeight } = this
        const { width } = bounds

        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
            height: chartHeight,
        }

        return (
            <div style={containerStyle}>
                <svg
                    {...this.svgProps}
                    width={width}
                    height={chartHeight}
                    viewBox={`0 0 ${width} ${chartHeight}`}
                >
                    {this.patterns}
                    {this.manager.isReady
                        ? this.renderChart()
                        : this.renderLoadingIndicator()}
                </svg>
            </div>
        )
    }

    private renderTimeline(): React.ReactElement {
        return (
            <TimelineComponent
                timelineController={this.manager.timelineController!}
                maxWidth={this.maxWidth}
                framePaddingHorizontal={this.framePaddingHorizontal}
            />
        )
    }

    // The height of the chart area is the total height of the frame minus the height of the header, footer, controls, etc.
    // Check out the render function for a description of the various components rendered by CaptionedChart
    @computed protected get chartHeight(): number {
        return Math.floor(
            this.bounds.height -
                2 * this.framePaddingVertical -
                // #1 Header
                this.header.height -
                this.verticalPadding -
                // #2 [Controls]
                (this.showControlsRow
                    ? CONTROLS_ROW_HEIGHT + this.verticalPaddingSmall
                    : 0) -
                // #4 [Timeline]
                (this.manager.hasTimeline
                    ? this.verticalPaddingSmall + TIMELINE_HEIGHT
                    : 0) -
                // #5 Footer
                this.verticalPadding -
                this.footer.height -
                // #6 [Related question]
                (this.showRelatedQuestion
                    ? this.relatedQuestionHeight -
                      this.framePaddingVertical * 0.25
                    : 0)
        )
    }

    // make sure to keep this.chartHeight in sync if you edit the render function
    render(): React.ReactElement {
        // CaptionedChart renders at the very least a header, a chart, and a footer.
        // Interactive charts also have controls above the chart area and a timeline below it.
        // Some charts have a related question below the footer.
        // A CaptionedChart looks like this (components in [brackets] are optional):
        //    #1 Header
        //            ---- vertical space
        //    #2 [Controls]
        //            ---- vertical space (small)
        //    #3 Chart/Map/Table
        //            ---- vertical space (small)
        //    #4 [Timeline]
        //            ---- vertical space
        //    #5 Footer
        //    #6 [Related question]
        return (
            <div className="CaptionedChart">
                {/* #1 Header */}
                <Header manager={this.manager} maxWidth={this.maxWidth} />
                <VerticalSpace height={this.verticalPadding} />

                {/* #2 [Controls] */}
                {this.showControlsRow && this.renderControlsRow()}
                {this.showControlsRow && (
                    <VerticalSpace height={this.verticalPaddingSmall} />
                )}

                {/* #3 Chart/Map/Table */}
                {this.manager.isOnTableTab
                    ? this.renderDataTable()
                    : this.renderChartOrMap()}

                {/* #4 [Timeline] */}
                {this.manager.hasTimeline && (
                    <VerticalSpace height={this.verticalPaddingSmall} />
                )}
                {this.manager.hasTimeline && this.renderTimeline()}

                {/* #5 Footer */}
                <VerticalSpace height={this.verticalPadding} />
                <Footer manager={this.manager} maxWidth={this.maxWidth} />

                {/* #6 [Related question] */}
                {this.showRelatedQuestion && this.renderRelatedQuestion()}
            </div>
        )
    }

    @computed protected get svgProps(): React.SVGProps<SVGSVGElement> {
        return {
            xmlns: "http://www.w3.org/2000/svg",
            version: "1.1",
            style: {
                fontFamily:
                    "Lato, 'Helvetica Neue', Helvetica, Arial, 'Liberation Sans', sans-serif",
                fontSize: this.manager.fontSize ?? BASE_FONT_SIZE,
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

    @computed protected get bounds(): Bounds {
        return this.props.bounds ?? this.manager.staticBounds ?? DEFAULT_BOUNDS
    }

    @computed protected get staticFooter(): Footer {
        const { paddedBounds } = this
        return new StaticFooter({
            manager: this.manager,
            maxWidth: this.maxWidth,
            targetX: paddedBounds.x,
            targetY: paddedBounds.bottom - this.footer.height,
        })
    }

    @computed protected get staticHeader(): Header {
        const { paddedBounds } = this
        return new StaticHeader({
            manager: this.manager,
            maxWidth: this.maxWidth,
            targetX: paddedBounds.x,
            targetY: paddedBounds.y,
        })
    }

    @computed protected get framePaddingVertical(): number {
        return DEFAULT_GRAPHER_FRAME_PADDING
    }

    @computed protected get framePaddingHorizontal(): number {
        return DEFAULT_GRAPHER_FRAME_PADDING
    }

    @computed private get paddedBounds(): Bounds {
        return this.bounds
            .padWidth(this.framePaddingHorizontal)
            .padHeight(this.framePaddingVertical)
    }

    @computed protected get boundsForChartArea(): Bounds {
        return this.paddedBounds
            .padTop(this.staticHeader.height)
            .padBottom(this.staticFooter.height + this.verticalPadding)
            .padTop(this.manager.isOnMapTab ? 0 : this.verticalPadding)
    }

    renderSVGDetails(): React.ReactElement {
        let yOffset = 0
        let previousOffset = 0
        return (
            <>
                <line
                    id={makeIdForHumanConsumption("separator-line")}
                    x1={this.framePaddingHorizontal}
                    y1={this.bounds.height}
                    x2={
                        this.boundsForChartArea.width +
                        this.framePaddingHorizontal
                    }
                    y2={this.bounds.height}
                    stroke="#e7e7e7"
                ></line>
                <g
                    id={makeIdForHumanConsumption("details")}
                    transform={`translate(15, ${
                        // + padding below the grey line
                        this.bounds.height + this.framePaddingVertical
                    })`}
                >
                    {this.manager.detailRenderers.map((detail, i) => {
                        previousOffset = yOffset
                        yOffset += detail.height + STATIC_EXPORT_DETAIL_SPACING
                        return detail.renderSVG(0, previousOffset, {
                            textProps: { key: i },
                        })
                    })}
                </g>
            </>
        )
    }

    @computed private get fonts(): React.ReactElement {
        let origin = ""
        try {
            if (this.manager.bakedGrapherURL)
                origin = new URL(this.manager.bakedGrapherURL).origin
        } catch (e) {}
        const css = `@import url(${origin}/fonts.css)`
        return (
            <defs>
                <style>{css}</style>
            </defs>
        )
    }

    render(): React.ReactElement {
        const { paddedBounds, manager, maxWidth } = this

        const bounds = this.manager.staticBoundsWithDetails ?? this.bounds
        const width = bounds.width
        const height = bounds.height

        const includeDetailsInStaticExport =
            manager.shouldIncludeDetailsInStaticExport &&
            !isEmpty(this.manager.detailRenderers)

        return (
            <svg
                {...this.svgProps}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {this.fonts}
                {this.patterns}
                <rect
                    className="background-fill"
                    fill={GRAPHER_BACKGROUND_COLOR}
                    width={width}
                    height={height}
                />
                <StaticHeader
                    manager={manager}
                    maxWidth={maxWidth}
                    targetX={paddedBounds.x}
                    targetY={paddedBounds.y}
                />
                <g
                    id={makeIdForHumanConsumption("chart-area")}
                    style={{ pointerEvents: "none" }}
                >
                    {/*
                     We cannot render a table to svg, but would rather display nothing at all to avoid issues.
                     See https://github.com/owid/owid-grapher/issues/3283
                    */}
                    {this.manager.isOnTableTab ? undefined : this.renderChart()}
                </g>
                <StaticFooter
                    manager={manager}
                    maxWidth={maxWidth}
                    targetX={paddedBounds.x}
                    targetY={paddedBounds.bottom - this.staticFooter.height}
                />
                {includeDetailsInStaticExport && this.renderSVGDetails()}
            </svg>
        )
    }
}

// Although a bit unconventional, adding vertical space as a <div />
// makes margin collapsing impossible and makes it easier to track the
// space available for the chart area (see the CaptionedChart's `chartHeight` method)
function VerticalSpace({ height }: { height: number }): React.ReactElement {
    return (
        <div
            className="VerticalSpace"
            style={{
                height,
                width: "100%",
            }}
        />
    )
}
