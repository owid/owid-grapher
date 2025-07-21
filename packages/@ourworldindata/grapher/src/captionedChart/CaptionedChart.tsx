import * as _ from "lodash-es"
import * as React from "react"
import { computed, override, makeObservable } from "mobx"
import { observer } from "mobx-react"
import {
    Bounds,
    exposeInstanceOnWindow,
    makeIdForHumanConsumption,
} from "@ourworldindata/utils"
import { MarkdownTextWrap, LoadingIndicator } from "@ourworldindata/components"
import { Header, StaticHeader } from "../header/Header"
import { Footer, StaticFooter } from "../footer/Footer"
import {
    STATIC_EXPORT_DETAIL_SPACING,
    GRAPHER_FRAME_PADDING_VERTICAL,
    GRAPHER_FRAME_PADDING_HORIZONTAL,
    DEFAULT_GRAPHER_BOUNDS,
} from "../core/GrapherConstants"
import { MapChartManager } from "../mapCharts/MapChartConstants"
import { ChartManager } from "../chart/ChartManager"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { FooterManager } from "../footer/FooterManager"
import { HeaderManager } from "../header/HeaderManager"
import { SelectionArray } from "../selection/SelectionArray"
import {
    EntityName,
    RelatedQuestionsConfig,
    Color,
    GrapherTabName,
    GrapherChartType,
} from "@ourworldindata/types"
import { DataTableManager } from "../dataTable/DataTableConstants"
import {
    TimelineComponent,
    TIMELINE_HEIGHT,
} from "../timeline/TimelineComponent"
import { TimelineController } from "../timeline/TimelineController"
import {
    ControlsRow,
    ControlsRowManager,
} from "../controls/controlsRow/ControlsRow"
import { GRAPHER_BACKGROUND_DEFAULT } from "../color/ColorConstants.js"
import { ChartAreaContent } from "../chart/ChartAreaContent"
import { getChartSvgProps } from "../chart/ChartUtils"
import { StaticChartWrapper } from "../chart/StaticChartWrapper"

export interface CaptionedChartManager
    extends ChartManager,
        MapChartManager,
        FooterManager,
        HeaderManager,
        DataTableManager,
        ControlsRowManager {
    bakedGrapherURL?: string
    isReady?: boolean
    whatAreWeWaitingFor?: string

    // bounds
    captionedChartBounds?: Bounds
    sidePanelBounds?: Bounds
    staticBounds?: Bounds
    staticBoundsWithDetails?: Bounds

    // layout & style
    isSmall?: boolean
    isMedium?: boolean
    fontSize?: number
    backgroundColor?: string

    // state
    activeTab?: GrapherTabName
    isOnMapTab?: boolean
    isOnTableTab?: boolean
    activeChartType?: GrapherChartType
    isFaceted?: boolean
    isExportingForSocialMedia?: boolean
    isExportingForWikimedia?: boolean

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
export const CONTROLS_ROW_HEIGHT = 32

abstract class AbstractCaptionedChart extends React.Component<CaptionedChartProps> {
    protected framePaddingHorizontal = GRAPHER_FRAME_PADDING_HORIZONTAL
    protected framePaddingVertical = GRAPHER_FRAME_PADDING_VERTICAL

    constructor(props: CaptionedChartProps) {
        super(props)
        makeObservable(this)
    }

    @computed protected get manager(): CaptionedChartManager {
        return this.props.manager
    }

    @computed protected get maxWidth(): number {
        return (
            this.props.maxWidth ??
            this.bounds.width - 2 * this.framePaddingHorizontal
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

    @computed protected get bounds(): Bounds {
        const bounds =
            this.props.bounds ??
            this.manager.captionedChartBounds ??
            DEFAULT_GRAPHER_BOUNDS
        // the padding ensures grapher's frame is not cut off
        return bounds.padRight(2).padBottom(2)
    }

    @computed protected get boundsForChartArea(): Bounds {
        const { bounds, chartHeight } = this
        return new Bounds(0, 0, bounds.width, chartHeight)
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
        return <LoadingIndicator title={this.manager.whatAreWeWaitingFor} />
    }

    private renderTimeline(): React.ReactElement {
        return (
            <TimelineComponent
                timelineController={this.manager.timelineController!}
                maxWidth={this.maxWidth}
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
            <div
                className="CaptionedChart"
                style={{
                    backgroundColor: this.backgroundColor,
                }}
            >
                {/* #1 Header */}
                <Header manager={this.manager} maxWidth={this.maxWidth} />
                <VerticalSpace height={this.verticalPadding} />

                {this.manager.isReady ? (
                    <>
                        {/* #2 [Controls] */}
                        {this.showControlsRow && this.renderControlsRow()}
                        {this.showControlsRow && (
                            <VerticalSpace height={this.verticalPaddingSmall} />
                        )}

                        {/* #3 Chart/Map/Table */}
                        <ChartAreaContent
                            manager={this.manager}
                            bounds={this.boundsForChartArea}
                            padWidth={GRAPHER_FRAME_PADDING_HORIZONTAL}
                        />

                        {/* #4 [Timeline] */}
                        {this.manager.hasTimeline && (
                            <VerticalSpace height={this.verticalPaddingSmall} />
                        )}
                        {this.manager.hasTimeline && this.renderTimeline()}

                        {/* #5 Footer */}
                        <VerticalSpace height={this.verticalPadding} />
                        <Footer
                            manager={this.manager}
                            maxWidth={this.maxWidth}
                        />

                        {/* #6 [Related question] */}
                        {this.showRelatedQuestion &&
                            this.renderRelatedQuestion()}
                    </>
                ) : (
                    this.renderLoadingIndicator()
                )}
            </div>
        )
    }

    @computed protected get backgroundColor(): Color {
        return this.manager.backgroundColor ?? GRAPHER_BACKGROUND_DEFAULT
    }

    @computed protected get svgProps(): React.SVGProps<SVGSVGElement> {
        return getChartSvgProps(this.manager)
    }
}

@observer
export class CaptionedChart extends AbstractCaptionedChart {}

@observer
export class StaticCaptionedChart extends AbstractCaptionedChart {
    constructor(props: CaptionedChartProps) {
        super(props)
        makeObservable(this)
    }

    // Bounds diagram
    //
    // +---------------------------+   |  |
    // |  Padding                  |   |  |
    // |  +--------------------+   |   |  |  |
    // |  | Header             |   |   |  |  |
    // |  |                    |   |   |  |  |
    // |  | Chart area         |   |   |  |  |
    // |  |                    |   |   |  |  |
    // |  | Footer             |   |   |  |  | innerBounds
    // |  +--------------------+   |   |  |
    // |  Padding                  |   |  |
    // +---------------------------+   |  | bounds
    // | Details                   |   |
    // +---------------------------+   | svgBounds

    /** Bounds of the SVG element including details */
    @computed private get svgBounds(): Bounds {
        return this.manager.staticBoundsWithDetails ?? this.bounds
    }

    /** Bounds without details */
    @override protected get bounds(): Bounds {
        return (
            this.props.bounds ??
            this.manager.staticBounds ??
            DEFAULT_GRAPHER_BOUNDS
        )
    }

    /** Padded bounds of the actual chart area (without whitespace around it) */
    @computed private get innerBounds(): Bounds {
        return this.bounds
            .padWidth(this.framePaddingHorizontal)
            .padHeight(this.framePaddingVertical)
    }

    /** Bounds of the chart area (without header and footer) */
    @override protected get boundsForChartArea(): Bounds {
        return this.innerBounds
            .padTop(this.staticHeader.height)
            .padBottom(this.staticFooter.height + this.verticalPadding)
            .padTop(this.manager.isOnMapTab ? 0 : this.verticalPadding)
    }

    @computed protected get staticFooter(): Footer {
        return new StaticFooter({
            manager: this.manager,
            maxWidth: this.maxWidth,
            targetX: this.innerBounds.x,
            targetY: this.innerBounds.bottom - this.footer.height,
        })
    }

    @computed protected get staticHeader(): Header {
        return new StaticHeader({
            manager: this.manager,
            maxWidth: this.maxWidth,
            targetX: this.innerBounds.x,
            targetY: this.innerBounds.y,
        })
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
                        return (
                            <React.Fragment key={i}>
                                {detail.renderSVG(0, previousOffset)}
                            </React.Fragment>
                        )
                    })}
                </g>
            </>
        )
    }

    render(): React.ReactElement {
        const { innerBounds, manager, maxWidth } = this

        const includeDetailsInStaticExport =
            manager.shouldIncludeDetailsInStaticExport &&
            !_.isEmpty(this.manager.detailRenderers)

        return (
            <StaticChartWrapper manager={this.manager} bounds={this.svgBounds}>
                <StaticHeader
                    manager={manager}
                    maxWidth={maxWidth}
                    targetX={innerBounds.x}
                    targetY={innerBounds.y}
                />
                <ChartAreaContent
                    manager={this.manager}
                    bounds={this.boundsForChartArea}
                />
                <StaticFooter
                    manager={manager}
                    maxWidth={maxWidth}
                    targetX={innerBounds.x}
                    targetY={innerBounds.bottom - this.staticFooter.height}
                />
                {includeDetailsInStaticExport && this.renderSVGDetails()}
            </StaticChartWrapper>
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
