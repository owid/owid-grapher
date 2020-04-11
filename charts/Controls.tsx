import * as React from "react"
import { observable, computed, action } from "mobx"
import { observer } from "mobx-react"
import * as Cookies from "js-cookie"

import { ChartConfig, ChartConfigProps } from "./ChartConfig"
import { getQueryParams, getWindowQueryParams } from "utils/client/url"
import { ChartView } from "./ChartView"
import { HighlightToggleConfig } from "./ChartConfig"
import { Timeline } from "./HTMLTimeline"
import { extend, keys, entries } from "./Util"
import { worldRegions, labelsByRegion } from "./WorldRegions"
import { ADMIN_BASE_URL, ENV } from "settings"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCode } from "@fortawesome/free-solid-svg-icons/faCode"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faCog } from "@fortawesome/free-solid-svg-icons/faCog"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faTwitter } from "@fortawesome/free-brands-svg-icons/faTwitter"
import { faFacebook } from "@fortawesome/free-brands-svg-icons/faFacebook"
import { ChartViewContext, ChartViewContextType } from "./ChartViewContext"
import { TimeBound } from "./TimeBounds"

@observer
class EmbedMenu extends React.Component<{
    chartView: ChartView
    embedUrl: string
}> {
    dismissable = true

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.props.chartView.removePopup(EmbedMenu)
        } else {
            this.dismissable = true
        }
    }

    @action.bound onClick() {
        this.dismissable = false
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    render() {
        const { embedUrl } = this.props

        return (
            <div className="embedMenu" onClick={this.onClick}>
                <h2>Embed</h2>
                <p>Paste this into any HTML page:</p>
                <textarea
                    onFocus={evt => evt.currentTarget.select()}
                    defaultValue={`<iframe src="${embedUrl}" style="width: 100%; height: 600px; border: 0px none;"></iframe>`}
                />
            </div>
        )
    }
}

@observer
class ShareMenu extends React.Component<{
    chart: ChartConfig
    chartView: any
    onDismiss: () => void
}> {
    dismissable = true

    @computed get title(): string {
        return this.props.chart.data.currentTitle
    }

    @computed get isDisabled(): boolean {
        return !this.props.chart.props.slug
    }

    @computed get editUrl(): string | undefined {
        return Cookies.get("isAdmin") || ENV === "development"
            ? `${ADMIN_BASE_URL}/admin/charts/${this.props.chart.props.id}/edit`
            : undefined
    }

    @computed get canonicalUrl(): string | undefined {
        return this.props.chart.url.canonicalUrl
    }

    @observable isEmbedMenuActive: boolean = false

    embedMenu: any

    @action.bound dismiss() {
        this.props.onDismiss()
    }

    @action.bound onClickSomewhere() {
        if (this.dismissable) {
            this.dismiss()
        } else {
            this.dismissable = true
        }
    }

    componentDidMount() {
        document.addEventListener("click", this.onClickSomewhere)
    }

    componentWillUnmount() {
        document.removeEventListener("click", this.onClickSomewhere)
    }

    @action.bound onEmbed() {
        if (this.canonicalUrl) {
            this.props.chartView.addPopup(
                <EmbedMenu
                    key="EmbedMenu"
                    chartView={this.props.chartView}
                    embedUrl={this.canonicalUrl}
                />
            )
            this.dismiss()
        }
    }

    @action.bound async onNavigatorShare() {
        if (this.canonicalUrl && navigator.share) {
            const shareData = {
                title: this.title,
                url: this.canonicalUrl
            }

            try {
                await navigator.share(shareData)
            } catch (err) {
                console.error("couldn't share using navigator.share", err)
            }
        }
    }

    @computed get twitterHref(): string {
        let href =
            "https://twitter.com/intent/tweet/?text=" +
            encodeURIComponent(this.title)
        if (this.canonicalUrl)
            href += "&url=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    @computed get facebookHref(): string {
        let href =
            "https://www.facebook.com/dialog/share?app_id=1149943818390250&display=page"
        if (this.canonicalUrl)
            href += "&href=" + encodeURIComponent(this.canonicalUrl)
        return href
    }

    render() {
        const { editUrl, twitterHref, facebookHref, isDisabled } = this

        return (
            <div
                className={"ShareMenu" + (isDisabled ? " disabled" : "")}
                onClick={action(() => (this.dismissable = false))}
            >
                <h2>Share</h2>
                <a
                    className="btn"
                    target="_blank"
                    title="Tweet a link"
                    href={twitterHref}
                >
                    <FontAwesomeIcon icon={faTwitter} /> Twitter
                </a>
                <a
                    className="btn"
                    target="_blank"
                    title="Share on Facebook"
                    href={facebookHref}
                >
                    <FontAwesomeIcon icon={faFacebook} /> Facebook
                </a>
                <a
                    className="btn"
                    title="Embed this visualization in another HTML document"
                    onClick={this.onEmbed}
                >
                    <FontAwesomeIcon icon={faCode} /> Embed
                </a>
                {"share" in navigator && (
                    <a
                        className="btn"
                        title="Share this visualization with an app on your device"
                        onClick={this.onNavigatorShare}
                    >
                        <FontAwesomeIcon icon={faShareAlt} /> Share via&hellip;
                    </a>
                )}
                {editUrl && (
                    <a
                        className="btn"
                        target="_blank"
                        title="Edit chart"
                        href={editUrl}
                    >
                        <FontAwesomeIcon icon={faEdit} /> Edit
                    </a>
                )}
            </div>
        )
    }
}

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

    @action.bound onProjectionChange(e: React.FormEvent<HTMLSelectElement>) {
        this.props.chart.map.props.projection = e.currentTarget.value as any
    }

    render() {
        const { chart } = this.props

        return (
            <div
                className="SettingsMenu"
                onClick={evt => evt.stopPropagation()}
            >
                <h2>Settings</h2>
                {chart.props.tab === "map" && (
                    <div className="form-field">
                        <label>World Region</label>
                        <select
                            value={chart.map.props.projection}
                            onChange={this.onProjectionChange}
                        >
                            {worldRegions.map(region => (
                                <option value={region}>
                                    {labelsByRegion[region]}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
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
            this.chart.data.selectedKeys = []
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
        const { stackedArea } = this.props.chart
        stackedArea.isRelative = !stackedArea.isRelative
    }

    render() {
        const { chart } = this.props

        let label = "Relative"
        if (chart.isScatter || chart.isTimeScatter)
            label = "Average annual change"
        else if (chart.isLineChart) label = "Relative change"

        const supported = !(chart.isLineChart && chart.lineChart.isSingleYear)

        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={supported ? chart.stackedArea.isRelative : false}
                    onChange={this.onToggle}
                    disabled={!supported}
                    data-track-note="chart-abs-rel-toggle"
                />{" "}
                {label}
            </label>
        )
    }
}

@observer
class ZoomToggle extends React.Component<{
    chart: ChartConfigProps
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
class TimelineControl extends React.Component<{ chart: ChartConfig }> {
    @action.bound onMapTargetChange({
        targetStartYear
    }: {
        targetStartYear: TimeBound
    }) {
        this.props.chart.map.targetYear = targetStartYear
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

    render() {
        const { chart } = this.props
        if (chart.props.tab === "map") {
            const { map } = chart
            const years = map.data.timelineYears
            if (years.length === 0) {
                return null
            }
            return (
                <Timeline
                    years={years}
                    onTargetChange={this.onMapTargetChange}
                    startYear={map.data.targetYear}
                    endYear={map.data.targetYear}
                    singleYearMode={true}
                />
            )
        } else if (chart.isScatter) {
            const years = chart.scatter.timelineYears
            if (years.length === 0) return null
            return (
                <Timeline
                    years={years}
                    onTargetChange={this.onChartTargetChange}
                    startYear={chart.timeDomain[0]}
                    endYear={chart.timeDomain[1]}
                    onStartDrag={this.onTimelineStart}
                    onStopDrag={this.onTimelineStop}
                />
            )
        } else if (chart.isLineChart) {
            const years = chart.lineChart.timelineYears
            if (years.length === 0) return null
            return (
                <Timeline
                    years={years}
                    onTargetChange={this.onChartTargetChange}
                    startYear={chart.timeDomain[0]}
                    endYear={chart.timeDomain[1]}
                    onStartDrag={this.onTimelineStart}
                    onStopDrag={this.onTimelineStop}
                    singleYearPlay={true}
                />
            )
        } else if (chart.isSlopeChart) {
            const years = chart.slopeChart.timelineYears
            if (years.length === 0) return null
            return (
                <Timeline
                    years={years}
                    onTargetChange={this.onChartTargetChange}
                    startYear={chart.timeDomain[0]}
                    endYear={chart.timeDomain[1]}
                    onStartDrag={this.onTimelineStart}
                    onStopDrag={this.onTimelineStop}
                    disablePlay={true}
                />
            )
        } else {
            const years = chart.lineChart.timelineYears
            if (years.length === 0) return null
            return (
                <Timeline
                    years={years}
                    onTargetChange={this.onChartTargetChange}
                    startYear={chart.timeDomain[0]}
                    endYear={chart.timeDomain[1]}
                    onStartDrag={this.onTimelineStart}
                    onStopDrag={this.onTimelineStop}
                />
            )
        }
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
    @observable paddingTop: number = 0

    @computed get addDataTerm() {
        const { chart } = this.props
        return chart.data.isSingleEntity ? "data" : chart.entityType
    }

    @computed get addButtonLabel() {
        return `Add ${this.addDataTerm}`
    }

    @computed get hasTimeline(): boolean {
        const { chart } = this.props
        if (chart.tab === "map" && chart.map.data.hasTimeline) return true
        else if (
            chart.tab === "chart" &&
            (chart.isTimeScatter || chart.isScatter) &&
            chart.scatter.hasTimeline
        )
            return true
        else if (chart.tab === "chart" && chart.isLineChart)
            return !chart.props.hideTimeline
        else if (chart.tab === "chart" && chart.isSlopeChart)
            return chart.slopeChart.hasTimeline
        else return false
    }

    @computed get hasInlineControls(): boolean {
        const { chart } = this.props
        return (
            chart.tab === "chart" &&
            ((chart.data.canAddData && !this.hasAddButton) ||
                chart.isScatter ||
                chart.data.canChangeEntity ||
                (chart.isStackedArea && chart.stackedArea.canToggleRelative) ||
                (chart.isLineChart && chart.lineChart.canToggleRelative))
        )
    }

    @computed get hasSettingsMenu(): boolean {
        return this.props.chart.tab === "map"
    }

    @computed get hasSpace(): boolean {
        return this.props.width > 700
    }

    @computed get hasAddButton(): boolean {
        const { chart } = this.props
        return (
            chart.primaryTab === "chart" &&
            !chart.isLocalExport &&
            chart.data.canAddData &&
            (chart.isLineChart || chart.isStackedArea || chart.isDiscreteBar)
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
        return this.footerLines * 40
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
    static contextType = ChartViewContext
    context!: ChartViewContextType

    static defaultProps = {
        align: "left",
        verticalAlign: "bottom",
        height: 21,
        label: "Add country"
    }

    @action setControlsPaddingTop(value: number) {
        this.context.chartView.controls.paddingTop = value
    }

    calcPaddingTop(): number {
        const { y, verticalAlign, height } = this.props
        const realY =
            verticalAlign === "bottom"
                ? y - height
                : verticalAlign === "middle"
                ? y - height / 2
                : y
        return Math.max(0, -realY)
    }

    // A hacky way to add padding at the top of the graph if there is no space
    // for the "Add country" button

    componentDidMount() {
        this.setControlsPaddingTop(this.calcPaddingTop())
    }

    componentDidUpdate() {
        this.setControlsPaddingTop(this.calcPaddingTop())
    }

    componentWillUnmount() {
        this.setControlsPaddingTop(0)
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
            buttonStyle.bottom = `${-y}px`
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
export class ControlsOverlay extends React.Component<{
    id: string
    children: JSX.Element
}> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    get controlOverlays() {
        return this.context.chartView.overlays
    }

    @action setOverlay(children: JSX.Element | undefined) {
        this.controlOverlays[this.props.id] = children
    }

    componentDidMount() {
        this.setOverlay(this.props.children)
    }

    componentDidUpdate() {
        this.setOverlay(this.props.children)
    }

    componentWillUnmount() {
        this.setOverlay(undefined)
    }

    render() {
        return null
    }
}

@observer
export class ControlsOverlayView extends React.Component<{
    chartView: ChartView
    controls: Controls
}> {
    @action.bound onDataSelect() {
        this.props.controls.props.chartView.isSelectingData = true
    }

    render() {
        const wrapperStyle: React.CSSProperties = {
            position: "relative",
            width: "1px",
            height: `${this.props.controls.paddingTop}px`
        }
        return (
            <div className="ControlsOverlay" style={wrapperStyle}>
                {entries(this.props.chartView.overlays).map(
                    ([key, children]) => (
                        <React.Fragment key={key}>{children}</React.Fragment>
                    )
                )}
            </div>
        )
    }
}

@observer
export class ControlsFooterView extends React.Component<{
    controls: Controls
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
        this.props.controls.props.chartView.isSelectingData = true
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
                            "tab clickable icon" +
                            (chart.tab === "download" ? " active" : "")
                        }
                        data-track-note="chart-click-download"
                        onClick={() => (chart.tab = "download")}
                        title="Download as .png or .svg"
                    >
                        <a>
                            <FontAwesomeIcon icon={faDownload} />
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
        const { hasAddButton } = props.controls
        const { chart } = props.controls.props
        return (
            <div className="extraControls">
                {chart.data.canAddData && !hasAddButton && (
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
                                {this.props.controls.addButtonLabel}
                            </span>
                        )}
                    </button>
                )}

                {chart.data.canChangeEntity && (
                    <button
                        type="button"
                        onClick={this.onDataSelect}
                        data-track-note="chart-change-entity"
                    >
                        <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                        {chart.entityType}
                    </button>
                )}

                {chart.isScatter && chart.highlightToggle && (
                    <HighlightToggle
                        chart={chart}
                        highlightToggle={chart.highlightToggle}
                    />
                )}
                {chart.isStackedArea && chart.stackedArea.canToggleRelative && (
                    <AbsRelToggle chart={chart} />
                )}
                {chart.isScatter && chart.scatter.canToggleRelative && (
                    <AbsRelToggle chart={chart} />
                )}
                {chart.isScatter && chart.data.hasSelection && (
                    <ZoomToggle chart={chart.props}></ZoomToggle>
                )}

                {chart.isLineChart && chart.lineChart.canToggleRelative && (
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
            hasSpace
        } = props.controls
        const { chart, chartView } = props.controls.props

        const timelineElement = hasTimeline && (
            <div className="footerRowSingle">
                <TimelineControl chart={this.props.controls.props.chart} />
            </div>
        )

        const inlineControlsElement = hasInlineControls && !hasSpace && (
            <div className="footerRowSingle">
                {this._getInlineControlsElement()}
            </div>
        )

        const tabsElement = hasSpace ? (
            <div className="footerRowMulti">
                <div>
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

        return (
            <div
                className="ControlsFooter"
                style={{ height: props.controls.footerHeight }}
            >
                {timelineElement}
                {inlineControlsElement}
                {tabsElement}
                {shareMenuElement}
                {settingsMenuElement}
            </div>
        )
    }
}
