import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import { ChartScript } from "charts/core/ChartScript"
import { ChartConfig } from "charts/core/ChartConfig"
import { getQueryParams, getWindowQueryParams } from "utils/client/url"
import { ChartView } from "charts/core/ChartView"
import { Timeline, TimelineProps } from "./Timeline"
import { extend, keys, entries, max, formatValue } from "charts/utils/Util"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faCog } from "@fortawesome/free-solid-svg-icons/faCog"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import { TimeBound } from "charts/utils/TimeBounds"
import {
    HighlightToggleConfig,
    ChartTabOption
} from "charts/core/ChartConstants"
import { ShareMenu } from "./ShareMenu"

@observer
class SettingsMenu extends React.Component<{
    chart: ChartConfig
    onDismiss: () => void
}> {
    @action.bound onClickOutside() {
        this.props.onDismiss()
    }

    componentDidMount() {
        setTimeout(() => {
            window.addEventListener("click", this.onClickOutside)
        }, 50)
    }

    componentWillUnmount() {
        window.removeEventListener("click", this.onClickOutside)
    }

    render() {
        return (
            <div
                className="SettingsMenu"
                onClick={evt => evt.stopPropagation()}
            >
                <h2>Settings</h2>
            </div>
        )
    }
}

@observer
class HighlightToggle extends React.Component<{
    chart: ChartConfig
    highlightToggle: HighlightToggleConfig
}> {
    @computed get chart() {
        return this.props.chart
    }
    @computed get highlight() {
        return this.props.highlightToggle
    }

    @computed get highlightParams() {
        return getQueryParams((this.highlight.paramStr || "").substring(1))
    }

    @action.bound onHighlightToggle(e: React.FormEvent<HTMLInputElement>) {
        if (e.currentTarget.checked) {
            const params = extend(getWindowQueryParams(), this.highlightParams)
            this.chart.url.populateFromQueryParams(params)
        } else {
            this.chart.selectedKeys = []
        }
    }

    get isHighlightActive() {
        const params = getWindowQueryParams()
        let isActive = true
        keys(this.highlightParams).forEach(key => {
            if (params[key] !== this.highlightParams[key]) isActive = false
        })
        return isActive
    }

    render() {
        const { highlight, isHighlightActive } = this
        return (
            <label className="clickable HighlightToggle">
                <input
                    type="checkbox"
                    checked={isHighlightActive}
                    onChange={this.onHighlightToggle}
                />{" "}
                {highlight.description}
            </label>
        )
    }
}

@observer
class AbsRelToggle extends React.Component<{ chart: ChartConfig }> {
    @action.bound onToggle() {
        this.props.chart.toggleRelativeMode()
    }

    render() {
        const { chart } = this.props

        let label = "Relative"
        if (chart.isScatter || chart.isTimeScatter)
            label = "Average annual change"
        else if (chart.isLineChart) label = "Relative change"

        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={chart.isRelativeMode}
                    onChange={this.onToggle}
                    data-track-note="chart-abs-rel-toggle"
                />{" "}
                {label}
            </label>
        )
    }
}

@observer
class ZoomToggle extends React.Component<{
    chart: ChartScript
}> {
    @action.bound onToggle() {
        this.props.chart.zoomToSelection = this.props.chart.zoomToSelection
            ? undefined
            : true
    }

    render() {
        const label = "Zoom to selection"
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.props.chart.zoomToSelection}
                    onChange={this.onToggle}
                    data-track-note="chart-zoom-to-selection"
                />{" "}
                {label}
            </label>
        )
    }
}

@observer
class FilterSmallCountriesToggle extends React.Component<{
    chart: ChartConfig
}> {
    render() {
        const label = `Hide countries < ${formatValue(
            this.props.chart.populationFilterOption,
            {}
        )} people`
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={!!this.props.chart.props.minPopulationFilter}
                    onChange={() =>
                        this.props.chart.toggleMinPopulationFilter()
                    }
                    data-track-note="chart-filter-small-countries"
                />{" "}
                {label}
            </label>
        )
    }
}

interface TimelineControlProps {
    chart: ChartConfig
    activeTab: ChartTabOption
}

@observer
class TimelineControl extends React.Component<TimelineControlProps> {
    @action.bound onMapTargetChange({
        targetStartYear
    }: {
        targetStartYear: TimeBound
    }) {
        this.props.chart.mapTransform.targetYear = targetStartYear
    }

    @action.bound onChartTargetChange({
        targetStartYear,
        targetEndYear
    }: {
        targetStartYear: TimeBound
        targetEndYear: TimeBound
    }) {
        this.props.chart.timeDomain = [targetStartYear, targetEndYear]
    }

    @action.bound onTimelineStart() {
        this.props.chart.useTimelineDomains = true
    }

    @action.bound onTimelineStop() {
        this.props.chart.useTimelineDomains = false
    }

    @computed private get startYear() {
        const { activeTab, chart } = this.props
        if (activeTab === "table")
            return (
                chart.dataTableTransform.autoSelectedStartYear ??
                chart.timeDomain[0]
            )
        if (activeTab === "map") return chart.mapTransform.targetYearProp
        return chart.activeTransform.startYear!
    }

    @computed private get endYear() {
        const { activeTab, chart } = this.props
        if (activeTab === "table")
            return chart.multiMetricTableMode
                ? chart.dataTableTransform.startYear
                : chart.timeDomain[1]
        if (activeTab === "map") return chart.mapTransform.targetYearProp
        return chart.activeTransform.endYear!
    }

    componentDidUpdate(prevProps: TimelineControlProps) {
        if (
            prevProps.activeTab !== this.props.activeTab &&
            this.props.activeTab !== "map"
        )
            this.onChartTargetChange({
                targetStartYear: this.startYear,
                targetEndYear: this.endYear
            })
    }

    @computed get timelineProps(): TimelineProps {
        const { activeTab, chart } = this.props
        return {
            chart,
            years:
                activeTab === "map"
                    ? chart.mapTransform.timelineYears
                    : chart.activeTransform.timelineYears,
            startYear: this.startYear,
            endYear: this.endYear,
            onTargetChange: this.onChartTargetChange,
            onStartDrag: this.onTimelineStart,
            onStopDrag: this.onTimelineStop
        }
    }

    render() {
        if (this.timelineProps.years.length === 0) return null

        const { activeTab, chart } = this.props

        if (activeTab === "map")
            return (
                <Timeline
                    {...this.timelineProps}
                    onTargetChange={this.onMapTargetChange}
                    singleYearMode={true}
                    onStartDrag={undefined}
                    onStopDrag={undefined}
                />
            )
        else if (activeTab === "table")
            return (
                <Timeline
                    {...this.timelineProps}
                    singleYearMode={chart.multiMetricTableMode}
                />
            )
        else if (chart.isLineChart)
            return <Timeline {...this.timelineProps} singleYearPlay={true} />
        else if (chart.isSlopeChart)
            return <Timeline {...this.timelineProps} disablePlay={true} />
        return <Timeline {...this.timelineProps} />
    }
}

export class Controls {
    props: { chart: ChartConfig; chartView: ChartView; width: number }
    constructor(props: {
        chart: ChartConfig
        chartView: ChartView
        width: number
    }) {
        this.props = props
    }

    @observable isShareMenuActive: boolean = false
    @observable isSettingsMenuActive: boolean = false

    @computed.struct get overlayPadding(): {
        top: number
        right: number
        bottom: number
        left: number
    } {
        const overlays = Object.values(this.props.chartView.overlays)
        return {
            top: max(overlays.map(overlay => overlay.props.paddingTop)) ?? 0,
            right:
                max(overlays.map(overlay => overlay.props.paddingRight)) ?? 0,
            bottom:
                max(overlays.map(overlay => overlay.props.paddingBottom)) ?? 0,
            left: max(overlays.map(overlay => overlay.props.paddingLeft)) ?? 0
        }
    }

    @computed get hasTimeline(): boolean {
        const { chart } = this.props
        if (chart.tab === "table") return !chart.props.hideTimeline
        if (chart.tab === "map") {
            return chart.mapTransform.hasTimeline
        } else if (chart.tab === "chart") {
            if (chart.isScatter || chart.isTimeScatter)
                return chart.scatterTransform.hasTimeline
            if (chart.isLineChart) return chart.lineChartTransform.hasTimeline
            if (chart.isSlopeChart) return chart.slopeChartTransform.hasTimeline
        }
        return false
    }

    @computed get hasInlineControls(): boolean {
        const { chart } = this.props
        return (
            (chart.tab === "chart" || chart.tab === "table") &&
            ((chart.canAddData && !chart.hasFloatingAddButton) ||
                chart.isScatter ||
                chart.canChangeEntity ||
                (chart.isStackedArea && chart.canToggleRelativeMode) ||
                (chart.isLineChart &&
                    chart.lineChartTransform.canToggleRelativeMode))
        )
    }

    @computed get hasSettingsMenu(): boolean {
        return false
    }

    @computed get hasSpace(): boolean {
        return this.props.width > 700
    }

    @computed get hasRelatedQuestion(): boolean {
        const { relatedQuestions } = this.props.chart.props
        return (
            !!relatedQuestions &&
            !!relatedQuestions.length &&
            !!relatedQuestions[0].text &&
            !!relatedQuestions[0].url
        )
    }

    @computed get footerLines(): number {
        let numLines = 1
        if (this.hasTimeline) numLines += 1
        if (this.hasInlineControls) numLines += 1
        if (this.hasSpace && this.hasInlineControls && numLines > 1)
            numLines -= 1
        return numLines
    }

    @computed get footerHeight(): number {
        const footerRowHeight = 32 // keep in sync with chart.scss' $footerRowHeight
        return (
            this.footerLines * footerRowHeight +
            (this.hasRelatedQuestion ? 20 : 0)
        )
    }
}

type HorizontalAlign = "left" | "right"
type VerticalAlign = "top" | "middle" | "bottom"

@observer
export class AddEntityButton extends React.Component<{
    x: number
    y: number
    align: HorizontalAlign
    verticalAlign: VerticalAlign
    height: number
    label: string
    onClick: () => void
}> {
    static defaultProps = {
        align: "left",
        verticalAlign: "bottom",
        height: 21,
        label: "Add country"
    }

    static calcPaddingTop(
        y: number,
        verticalAlign: VerticalAlign,
        height: number
    ): number {
        const realY =
            verticalAlign === "bottom"
                ? y - height
                : verticalAlign === "middle"
                ? y - height / 2
                : y
        return Math.max(0, -realY)
    }

    render() {
        const {
            x,
            y,
            align,
            verticalAlign,
            height,
            label,
            onClick
        } = this.props

        const buttonStyle: React.CSSProperties = {
            position: "absolute",
            lineHeight: `${height}px`
        }

        if (verticalAlign === "top") {
            buttonStyle.top = `${y}px`
        } else if (verticalAlign === "bottom") {
            buttonStyle.top = `${y - height}px`
        } else {
            buttonStyle.top = `${y - height / 2}px`
        }

        if (align === "left") {
            buttonStyle.left = `${x}px`
        } else if (align === "right") {
            buttonStyle.right = `${-x}px`
        }

        return (
            <button
                className="addDataButton clickable"
                onClick={onClick}
                data-track-note="chart-add-entity"
                style={buttonStyle}
            >
                <span className="icon">
                    <svg width={16} height={16}>
                        <path d="M3,8 h10 m-5,-5 v10" />
                    </svg>
                </span>
                <span className="label">{label}</span>
            </button>
        )
    }
}

@observer
export class ControlsOverlayView extends React.Component<{
    chartView: ChartView
    chart: ChartConfig
    controls: Controls
    children: JSX.Element
}> {
    @action.bound onDataSelect() {
        this.props.chart.isSelectingData = true
    }

    render() {
        const { overlayPadding } = this.props.controls
        const containerStyle: React.CSSProperties = {
            position: "relative",
            clear: "both",
            paddingTop: `${overlayPadding.top}px`,
            paddingRight: `${overlayPadding.right}px`,
            paddingBottom: `${overlayPadding.bottom}px`,
            paddingLeft: `${overlayPadding.left}px`
        }
        const overlayStyle: React.CSSProperties = {
            position: "absolute",
            // Overlays should be positioned relative to the same origin
            // as the <svg>
            top: `${overlayPadding.top}px`,
            left: `${overlayPadding.left}px`,
            // Create 0px element to avoid capturing events.
            // Can achieve the same with `pointer-events: none`, but then control
            // has to override `pointer-events` to capture events.
            width: "0px",
            height: "0px"
        }
        return (
            <div style={containerStyle}>
                {this.props.children}
                <div className="ControlsOverlay" style={overlayStyle}>
                    {entries(this.props.chartView.overlays).map(
                        ([key, overlay]) => (
                            <React.Fragment key={key}>
                                {overlay.props.children}
                            </React.Fragment>
                        )
                    )}
                </div>
            </div>
        )
    }
}

@observer
export class ControlsFooterView extends React.Component<{
    controls: Controls
    chart: ChartConfig
}> {
    @action.bound onShareMenu() {
        this.props.controls.isShareMenuActive = !this.props.controls
            .isShareMenuActive
    }

    @action.bound onSettingsMenu() {
        this.props.controls.isSettingsMenuActive = !this.props.controls
            .isSettingsMenuActive
    }

    @action.bound onDataSelect() {
        this.props.chart.isSelectingData = true
    }

    private _getTabsElement() {
        const { props } = this
        const { hasSettingsMenu } = props.controls
        const { chart } = props.controls.props
        return (
            <nav className="tabs">
                <ul>
                    {chart.availableTabs.map(tabName => {
                        return (
                            tabName !== "download" && (
                                <li
                                    key={tabName}
                                    className={
                                        "tab clickable" +
                                        (tabName === chart.tab ? " active" : "")
                                    }
                                    onClick={() => (chart.tab = tabName)}
                                >
                                    <a
                                        data-track-note={
                                            "chart-click-" + tabName
                                        }
                                    >
                                        {tabName}
                                    </a>
                                </li>
                            )
                        )
                    })}
                    <li
                        className={
                            "tab clickable icon download-tab-button" +
                            (chart.tab === "download" ? " active" : "")
                        }
                        data-track-note="chart-click-download"
                        onClick={() => (chart.tab = "download")}
                        title="Download as .png or .svg"
                    >
                        <a>
                            <FontAwesomeIcon icon={faDownload} /> Download
                        </a>
                    </li>
                    <li className="clickable icon">
                        <a
                            title="Share"
                            onClick={this.onShareMenu}
                            data-track-note="chart-click-share"
                        >
                            <FontAwesomeIcon icon={faShareAlt} />
                        </a>
                    </li>
                    {hasSettingsMenu && (
                        <li className="clickable icon">
                            <a
                                title="Settings"
                                onClick={this.onSettingsMenu}
                                data-track-note="chart-click-settings"
                            >
                                <FontAwesomeIcon icon={faCog} />
                            </a>
                        </li>
                    )}
                    {chart.isEmbed && (
                        <li className="clickable icon">
                            <a
                                title="Open chart in new tab"
                                href={chart.url.canonicalUrl}
                                data-track-note="chart-click-newtab"
                                target="_blank"
                            >
                                <FontAwesomeIcon icon={faExpand} />
                            </a>
                        </li>
                    )}
                </ul>
            </nav>
        )
    }

    private _getInlineControlsElement() {
        const { props } = this
        const { chart } = props.controls.props
        return (
            <div className="extraControls">
                {chart.tab === "chart" &&
                    chart.canAddData &&
                    !chart.hasFloatingAddButton &&
                    !chart.hideEntityControls && (
                        <button
                            type="button"
                            onClick={this.onDataSelect}
                            data-track-note="chart-select-entities"
                        >
                            {chart.isScatter || chart.isSlopeChart ? (
                                <span className="SelectEntitiesButton">
                                    <FontAwesomeIcon icon={faPencilAlt} />
                                    {`Select ${chart.entityTypePlural}`}
                                </span>
                            ) : (
                                <span>
                                    <FontAwesomeIcon icon={faPlus} />{" "}
                                    {chart.addButtonLabel}
                                </span>
                            )}
                        </button>
                    )}

                {chart.tab === "chart" &&
                    chart.canChangeEntity &&
                    !chart.hideEntityControls && (
                        <button
                            type="button"
                            onClick={this.onDataSelect}
                            data-track-note="chart-change-entity"
                        >
                            <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                            {chart.entityType}
                        </button>
                    )}

                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.highlightToggle && (
                        <HighlightToggle
                            chart={chart}
                            highlightToggle={chart.highlightToggle}
                        />
                    )}
                {chart.tab === "chart" &&
                    chart.isStackedArea &&
                    chart.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.scatterTransform.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
                {chart.tab === "chart" &&
                    chart.isScatter &&
                    chart.hasSelection && <ZoomToggle chart={chart.props} />}

                {(chart.tab === "table" || chart.isScatter) &&
                    chart.hasCountriesSmallerThanFilterOption && (
                        <FilterSmallCountriesToggle chart={chart} />
                    )}

                {chart.tab === "chart" &&
                    chart.isLineChart &&
                    chart.lineChartTransform.canToggleRelativeMode && (
                        <AbsRelToggle chart={chart} />
                    )}
            </div>
        )
    }

    render() {
        const { props } = this
        const {
            isShareMenuActive,
            isSettingsMenuActive,
            hasTimeline,
            hasInlineControls,
            hasSpace,
            hasRelatedQuestion
        } = props.controls
        const { chart, chartView } = props.controls.props
        const { relatedQuestions } = chart.props

        const timelineElement = hasTimeline && (
            <div className="footerRowSingle">
                <TimelineControl chart={chart} activeTab={chart.tab} />
            </div>
        )

        const inlineControlsElement = hasInlineControls && !hasSpace && (
            <div className="footerRowSingle">
                {this._getInlineControlsElement()}
            </div>
        )

        const tabsElement = hasSpace ? (
            <div className="footerRowMulti">
                <div className="inline-controls">
                    {hasInlineControls && this._getInlineControlsElement()}
                </div>
                {this._getTabsElement()}
            </div>
        ) : (
            <div className="footerRowSingle">{this._getTabsElement()}</div>
        )

        const shareMenuElement = isShareMenuActive && (
            <ShareMenu
                chartView={chartView}
                chart={chart}
                onDismiss={this.onShareMenu}
            />
        )

        const settingsMenuElement = isSettingsMenuActive && (
            <SettingsMenu chart={chart} onDismiss={this.onSettingsMenu} />
        )

        const relatedQuestionElement = relatedQuestions && hasRelatedQuestion && (
            <div className="relatedQuestion">
                Related:&nbsp;
                <a
                    href={relatedQuestions[0].url}
                    target="_blank"
                    rel="noopener"
                    data-track-note="chart-click-related"
                >
                    {relatedQuestions[0].text}
                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                </a>
            </div>
        )

        return (
            <div
                className={"ControlsFooter"}
                style={{ height: props.controls.footerHeight }}
            >
                {timelineElement}
                {inlineControlsElement}
                {tabsElement}
                {shareMenuElement}
                {settingsMenuElement}
                {relatedQuestionElement}
            </div>
        )
    }
}
