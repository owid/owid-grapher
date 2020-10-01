import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"
import { getQueryParams, getWindowQueryParams } from "utils/client/url"
import { GrapherView } from "grapher/core/GrapherView"
import {
    TimelineComponent,
    TimelineComponentProps,
} from "grapher/timeline/TimelineComponent"
import { formatValue, isMobile } from "grapher/utils/Util"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import { HighlightToggleConfig } from "grapher/core/GrapherConstants"
import { ShareMenu } from "./ShareMenu"

@observer
export class HighlightToggle extends React.Component<{
    grapher: Grapher
    highlightToggle: HighlightToggleConfig
}> {
    @computed get grapher() {
        return this.props.grapher
    }
    @computed get highlight() {
        return this.props.highlightToggle
    }

    @computed get highlightParams() {
        return getQueryParams((this.highlight.paramStr || "").substring(1))
    }

    @action.bound onHighlightToggle(e: React.FormEvent<HTMLInputElement>) {
        if (e.currentTarget.checked) {
            const params = {
                ...getWindowQueryParams(),
                ...this.highlightParams,
            }
            this.grapher.populateFromQueryParams(params)
        } else {
            this.grapher.selectedKeys = []
        }
    }

    get isHighlightActive() {
        const params = getWindowQueryParams()
        let isActive = true
        Object.keys(this.highlightParams).forEach((key) => {
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
                &nbsp;{highlight.description}
            </label>
        )
    }
}

@observer
export class AbsRelToggle extends React.Component<{ grapher: Grapher }> {
    @action.bound onToggle() {
        this.props.grapher.toggleRelativeMode()
    }

    render() {
        const { grapher } = this.props

        let label = "Relative"
        if (grapher.isScatter || grapher.isTimeScatter)
            label = "Average annual change"
        else if (grapher.isLineChart) label = "Relative change"

        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={grapher.isRelativeMode}
                    onChange={this.onToggle}
                    data-track-note="chart-abs-rel-toggle"
                />{" "}
                &nbsp;{label}
            </label>
        )
    }
}

@observer
export class ZoomToggle extends React.Component<{
    grapher: GrapherInterface
}> {
    @action.bound onToggle() {
        this.props.grapher.zoomToSelection = this.props.grapher.zoomToSelection
            ? undefined
            : true
    }

    render() {
        const label = "Zoom to selection"
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.props.grapher.zoomToSelection}
                    onChange={this.onToggle}
                    data-track-note="chart-zoom-to-selection"
                />{" "}
                &nbsp;
                {label}
            </label>
        )
    }
}

@observer
export class FilterSmallCountriesToggle extends React.Component<{
    grapher: Grapher
}> {
    render() {
        const label = `Hide countries < ${formatValue(
            this.props.grapher.populationFilterOption,
            {}
        )} people`
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={!!this.props.grapher.minPopulationFilter}
                    onChange={() =>
                        this.props.grapher.toggleMinPopulationFilter()
                    }
                    data-track-note="chart-filter-small-countries"
                />{" "}
                &nbsp;{label}
            </label>
        )
    }
}

@observer
export class ControlsFooterView extends React.Component<{
    grapherView: GrapherView
}> {
    @computed private get grapher() {
        return this.grapherView.grapher
    }

    @computed private get grapherView() {
        return this.props.grapherView
    }

    @action.bound onShareMenu() {
        this.grapherView.isShareMenuActive = !this.grapherView.isShareMenuActive
    }

    @action.bound onDataSelect() {
        this.grapher.isSelectingData = true
    }

    private _getTabsElement() {
        const { grapher } = this
        return (
            <nav className="tabs">
                <ul>
                    {grapher.availableTabs.map((tabName) => {
                        return (
                            tabName !== "download" && (
                                <li
                                    key={tabName}
                                    className={
                                        "tab clickable" +
                                        (tabName === grapher.currentTab
                                            ? " active"
                                            : "")
                                    }
                                    onClick={() =>
                                        (grapher.currentTab = tabName)
                                    }
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
                            (grapher.currentTab === "download" ? " active" : "")
                        }
                        data-track-note="chart-click-download"
                        onClick={() => (grapher.currentTab = "download")}
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
                    {grapher.isEmbed && (
                        <li className="clickable icon">
                            <a
                                title="Open chart in new tab"
                                href={grapher.url.canonicalUrl}
                                data-track-note="chart-click-newtab"
                                target="_blank"
                                rel="noopener"
                            >
                                <FontAwesomeIcon icon={faExpand} />
                            </a>
                        </li>
                    )}
                </ul>
            </nav>
        )
    }

    @computed private get timeline() {
        if (!this.grapherView.hasTimeline) return null

        const grapher = this.grapher

        if (!this.grapher.times.length) return null

        const props: TimelineComponentProps = {
            target: grapher,
            onPlay: () => {
                grapher.analytics.logChartTimelinePlay(grapher.slug)
            },
            formatTimeFn: (value: number) => {
                const timeColumn = grapher.table.timeColumn
                if (!timeColumn)
                    return grapher.table.timeColumnFormatFunction(value)
                return isMobile()
                    ? timeColumn.formatValueForMobile(value)
                    : timeColumn.formatValue(value)
            },
            onStartPlayOrDrag: () => {
                grapher.url.debounceMode = true
                grapher.useTimelineDomains = true
            },
            onStopPlayOrDrag: () => {
                grapher.url.debounceMode = false
                grapher.useTimelineDomains = false
            },
            disablePlay: grapher.isSlopeChart,
        }

        return (
            <div className="footerRowSingle">
                <TimelineComponent {...props} />
            </div>
        )
    }

    render() {
        const { grapher, grapherView } = this
        const { isShareMenuActive, hasRelatedQuestion } = grapherView
        const { relatedQuestions } = grapher

        const tabsElement = (
            <div className="footerRowSingle">{this._getTabsElement()}</div>
        )

        const shareMenuElement = isShareMenuActive && (
            <ShareMenu
                grapherView={grapherView}
                grapher={grapher}
                onDismiss={this.onShareMenu}
            />
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
                style={{ height: grapherView.footerHeight }}
            >
                {this.timeline}
                {tabsElement}
                {shareMenuElement}
                {relatedQuestionElement}
            </div>
        )
    }
}
