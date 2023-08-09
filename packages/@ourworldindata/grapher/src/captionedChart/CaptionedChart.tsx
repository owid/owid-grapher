import React from "react"
import { computed } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    DEFAULT_BOUNDS,
    exposeInstanceOnWindow,
    MarkdownTextWrap,
    sumTextWrapHeights,
} from "@ourworldindata/utils"
import { Header } from "../header/Header"
import { Footer, StaticFooter } from "../footer/Footer"
import {
    ChartComponentClassMap,
    DefaultChartClass,
} from "../chart/ChartTypeMap"
import {
    BASE_FONT_SIZE,
    ChartTypeName,
    FacetStrategy,
    GrapherTabOption,
    Patterns,
    RelatedQuestionsConfig,
    STATIC_EXPORT_DETAIL_SPACING,
} from "../core/GrapherConstants"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { ChartManager } from "../chart/ChartManager"
import { LoadingIndicator } from "../loadingIndicator/LoadingIndicator"
import { FacetChart } from "../facetChart/FacetChart"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    SettingsMenuManager,
    SettingsMenu,
    EntitySelectorToggle,
} from "../controls/Controls"
import { FooterManager } from "../footer/FooterManager"
import { HeaderManager } from "../header/HeaderManager"
import { SelectionArray } from "../selection/SelectionArray"
import { EntityName } from "@ourworldindata/core-table"
import { AxisConfig } from "../axis/AxisConfig"
import { DataTable, DataTableManager } from "../dataTable/DataTable"
import {
    ContentSwitchers,
    ContentSwitchersManager,
} from "../controls/ContentSwitchers"
import { TimelineComponent } from "../timeline/TimelineComponent"
import { TimelineController } from "../timeline/TimelineController"

export interface CaptionedChartManager
    extends ChartManager,
        MapChartManager,
        FooterManager,
        HeaderManager,
        SettingsMenuManager,
        DataTableManager,
        ContentSwitchersManager {
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
    showSettingsMenuToggle?: boolean
    showYScaleToggle?: boolean
    showXScaleToggle?: boolean
    showZoomToggle?: boolean
    showAbsRelToggle?: boolean
    showNoDataAreaToggle?: boolean
    showFacetYDomainToggle?: boolean
    showChangeEntityButton?: boolean
    showAddEntityButton?: boolean
    showSelectEntitiesButton?: boolean
    shouldIncludeDetailsInStaticExport?: boolean
    detailRenderers: MarkdownTextWrap[]
    isOnMapTab?: boolean
    isOnTableTab?: boolean
    showTimeline?: boolean
    timelineController?: TimelineController
    hasRelatedQuestion?: boolean
    isRelatedQuestionTargetDifferentFromCurrentPage?: boolean
    relatedQuestions?: RelatedQuestionsConfig[]
}

interface CaptionedChartProps {
    manager: CaptionedChartManager
    bounds?: Bounds
    maxWidth?: number
}

const VERTICAL_SPACING = 16

// keep in sync with sass variables in CaptionedChart.scss
const FRAME_PADDING = VERTICAL_SPACING
const CONTROLS_ROW_HEIGHT = 34
const RELATED_QUESTION_HEIGHT = 28

const TIMELINE_HEIGHT = 32

// todo(redesign): we might want to rename CaptionedChart later

@observer
export class CaptionedChart extends React.Component<CaptionedChartProps> {
    @computed protected get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed private get containerElement(): HTMLDivElement | undefined {
        return this.manager?.containerElement
    }

    @computed protected get maxWidth(): number {
        return this.props.maxWidth ?? this.bounds.width - FRAME_PADDING * 2
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

    protected get patterns(): JSX.Element {
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

    @computed protected get chartHeight(): number {
        return Math.floor(
            this.bounds.height -
                2 * FRAME_PADDING -
                2 * VERTICAL_SPACING -
                this.header.height -
                (this.showControlsRow
                    ? VERTICAL_SPACING + CONTROLS_ROW_HEIGHT
                    : 0) -
                (this.manager.showTimeline
                    ? VERTICAL_SPACING + TIMELINE_HEIGHT
                    : 0) -
                this.footer.height -
                (this.showRelatedQuestion ? RELATED_QUESTION_HEIGHT : 0)
        )
    }

    @computed protected get bounds(): Bounds {
        return this.props.bounds ?? this.manager.tabBounds ?? DEFAULT_BOUNDS
    }

    @computed protected get boundsForChartArea(): Bounds {
        const { bounds, chartHeight } = this
        return new Bounds(0, 0, bounds.width, chartHeight).padWidth(
            FRAME_PADDING
        )
    }

    @computed get isFaceted(): boolean {
        const hasStrategy =
            !!this.manager.facetStrategy &&
            this.manager.facetStrategy !== FacetStrategy.none
        return !this.manager.isOnMapTab && hasStrategy
    }

    @computed get showControlsRow(): boolean {
        return (this.manager.availableTabs?.length ?? 0) > 1
    }

    @computed get chartTypeName(): ChartTypeName {
        const { manager } = this
        return this.manager.isOnMapTab
            ? ChartTypeName.WorldMap
            : manager.typeExceptWhenLineChartAndSingleTimeThenWillBeBarChart ??
                  manager.type ??
                  ChartTypeName.LineChart
    }

    renderChart(): JSX.Element {
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

    @computed get showRelatedQuestion(): boolean {
        return (
            !!this.manager.relatedQuestions &&
            !!this.manager.hasRelatedQuestion &&
            !!this.manager.isRelatedQuestionTargetDifferentFromCurrentPage
        )
    }

    @computed get showEntitySelector(): boolean {
        const {
            showSelectEntitiesButton,
            showChangeEntityButton,
            // showAddEntityButton,
        } = this.manager

        // TODO: merge addEntity behavior into EntitySelectorToggle

        return !!showSelectEntitiesButton || !!showChangeEntityButton
    }

    @computed get showSettingsMenuToggle(): boolean {
        return (
            !!this.manager.showSettingsMenuToggle &&
            !!this.manager.isReady &&
            !this.manager.isOnMapTab &&
            !this.manager.isOnTableTab
        )
    }

    private renderControlsRow(): JSX.Element | null {
        const { showEntitySelector, showSettingsMenuToggle } = this
        return (
            <nav className="controlsRow">
                <ContentSwitchers manager={this.manager} />
                <div className="controls">
                    {showEntitySelector && (
                        <EntitySelectorToggle manager={this.manager} />
                    )}
                    {showSettingsMenuToggle && (
                        <SettingsMenu
                            manager={this.manager}
                            top={
                                FRAME_PADDING +
                                this.header.height +
                                VERTICAL_SPACING +
                                CONTROLS_ROW_HEIGHT +
                                4 // margin between button and menu
                            }
                            bottom={FRAME_PADDING}
                            chart={this.chartTypeName}
                        />
                    )}
                </div>
            </nav>
        )
    }

    private renderRelatedQuestion(): JSX.Element {
        const { relatedQuestions } = this.manager
        return (
            <div className="relatedQuestion">
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

    private renderLoadingIndicator(): JSX.Element {
        return (
            <foreignObject {...this.boundsForChartArea.toProps()}>
                <LoadingIndicator title={this.manager.whatAreWeWaitingFor} />
            </foreignObject>
        )
    }

    private renderDataTable(): JSX.Element {
        const { boundsForChartArea } = this
        const containerStyle: React.CSSProperties = {
            position: "relative",
            ...this.boundsForChartArea.toCSS(),
        }
        return (
            <div style={containerStyle}>
                <DataTable bounds={boundsForChartArea} manager={this.manager} />
            </div>
        )
    }

    private renderChartOrMap(): JSX.Element {
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

    private renderTimeline(): JSX.Element {
        return (
            <TimelineComponent
                timelineController={this.manager.timelineController!}
                height={TIMELINE_HEIGHT}
                maxWidth={this.maxWidth}
            />
        )
    }

    private renderVerticalSpace(): JSX.Element {
        return (
            <div
                style={{
                    height: VERTICAL_SPACING,
                    width: this.bounds.width,
                }}
            />
        )
    }

    render(): JSX.Element {
        return (
            <>
                <Header manager={this.manager} maxWidth={this.maxWidth} />
                {this.showControlsRow && this.renderVerticalSpace()}
                {this.showControlsRow && this.renderControlsRow()}
                {this.renderVerticalSpace()}
                {this.manager.isOnTableTab
                    ? this.renderDataTable()
                    : this.renderChartOrMap()}
                {this.manager.showTimeline && this.renderVerticalSpace()}
                {this.manager.showTimeline && this.renderTimeline()}
                {this.renderVerticalSpace()}
                <Footer manager={this.manager} maxWidth={this.maxWidth} />
                {this.showRelatedQuestion && this.renderRelatedQuestion()}
            </>
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
                backgroundColor: "white",
                textRendering: "geometricPrecision",
                WebkitFontSmoothing: "antialiased",
                overflow: "visible",
            },
        }
    }
}

@observer
export class StaticCaptionedChart extends CaptionedChart {
    constructor(props: CaptionedChartProps) {
        super(props)
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

    @computed private get paddedBounds(): Bounds {
        return this.bounds.pad(FRAME_PADDING)
    }

    @computed protected get boundsForChartArea(): Bounds {
        return this.paddedBounds
            .padTop(Math.max(this.header.height, this.header.logoHeight))
            .padBottom(this.staticFooter.height + VERTICAL_SPACING)
            .padTop(this.manager.isOnMapTab ? 0 : VERTICAL_SPACING)
    }

    renderSVGDetails(): JSX.Element | null {
        if (!this.manager.shouldIncludeDetailsInStaticExport) {
            return null
        }

        let yOffset = 0
        let previousOffset = 0
        return (
            <>
                <line
                    x1={FRAME_PADDING}
                    y1={this.bounds.height}
                    x2={this.boundsForChartArea.width + FRAME_PADDING}
                    y2={this.bounds.height}
                    stroke="#777"
                ></line>
                <g
                    style={{
                        transform: `translate(15px, ${
                            // + padding below the grey line
                            this.bounds.height + FRAME_PADDING
                        }px)`,
                    }}
                >
                    {this.manager.detailRenderers.map((detail, i) => {
                        previousOffset = yOffset
                        yOffset += detail.height + STATIC_EXPORT_DETAIL_SPACING
                        return detail.renderSVG(0, previousOffset, { key: i })
                    })}
                </g>
            </>
        )
    }

    render(): JSX.Element {
        const { bounds, paddedBounds, manager, maxWidth } = this
        let { width, height } = bounds

        if (this.manager.shouldIncludeDetailsInStaticExport) {
            height += sumTextWrapHeights(
                this.manager.detailRenderers,
                STATIC_EXPORT_DETAIL_SPACING
            )
        }

        return (
            <svg
                {...this.svgProps}
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
            >
                {this.patterns}
                <rect
                    className="background-fill"
                    fill="white"
                    width={width}
                    height={height}
                />
                {this.header.renderStatic(paddedBounds.x, paddedBounds.y)}
                {this.renderChart()}
                <StaticFooter
                    manager={manager}
                    maxWidth={maxWidth}
                    targetX={paddedBounds.x}
                    targetY={paddedBounds.bottom - this.staticFooter.height}
                />
                {this.renderSVGDetails()}
            </svg>
        )
    }
}
