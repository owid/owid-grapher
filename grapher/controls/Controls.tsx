import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"
import { getQueryParams, getWindowQueryParams } from "utils/client/url"
import {
    TimelineComponent,
    TimelineComponentProps,
} from "grapher/timeline/TimelineComponent"
import { formatValue, isMobile } from "grapher/utils/Util"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faPlus } from "@fortawesome/free-solid-svg-icons/faPlus"
import { faPencilAlt } from "@fortawesome/free-solid-svg-icons/faPencilAlt"
import { faExchangeAlt } from "@fortawesome/free-solid-svg-icons/faExchangeAlt"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import {
    GrapherTabOption,
    HighlightToggleConfig,
} from "grapher/core/GrapherConstants"
import { ShareMenu } from "./ShareMenu"

@observer
class HighlightToggle extends React.Component<{
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
        } else this.grapher.table.clearSelection()
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
                {highlight.description}
            </label>
        )
    }
}

@observer
class AbsRelToggle extends React.Component<{ grapher: Grapher }> {
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
                {label}
            </label>
        )
    }
}

@observer
class ZoomToggle extends React.Component<{
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
                {label}
            </label>
        )
    }
}

@observer
class FilterSmallCountriesToggle extends React.Component<{
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
                {label}
            </label>
        )
    }
}

@observer
export class ControlsFooterView extends React.Component<{
    grapher: Grapher
}> {
    @computed private get grapher() {
        return this.props.grapher
    }

    @action.bound onShareMenu() {
        this.grapher.isShareMenuActive = !this.grapher.isShareMenuActive
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
                            tabName !== GrapherTabOption.download && (
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
                            (grapher.currentTab === GrapherTabOption.download
                                ? " active"
                                : "")
                        }
                        data-track-note="chart-click-download"
                        onClick={() =>
                            (grapher.currentTab = GrapherTabOption.download)
                        }
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
        const { grapher } = this
        return (
            <div className="extraControls">
                {grapher.currentTab === GrapherTabOption.chart &&
                    grapher.canAddData &&
                    !grapher.hasFloatingAddButton &&
                    !grapher.hideEntityControls && (
                        <button
                            type="button"
                            onClick={this.onDataSelect}
                            data-track-note="chart-select-entities"
                        >
                            {grapher.isScatter || grapher.isSlopeChart ? (
                                <span className="SelectEntitiesButton">
                                    <FontAwesomeIcon icon={faPencilAlt} />
                                    {`Select ${grapher.entityTypePlural}`}
                                </span>
                            ) : (
                                <span>
                                    <FontAwesomeIcon icon={faPlus} />{" "}
                                    {grapher.addButtonLabel}
                                </span>
                            )}
                        </button>
                    )}

                {grapher.currentTab === GrapherTabOption.chart &&
                    grapher.canChangeEntity &&
                    !grapher.hideEntityControls && (
                        <button
                            type="button"
                            onClick={this.onDataSelect}
                            data-track-note="chart-change-entity"
                        >
                            <FontAwesomeIcon icon={faExchangeAlt} /> Change{" "}
                            {grapher.entityType}
                        </button>
                    )}

                {grapher.currentTab === GrapherTabOption.chart &&
                    grapher.isScatter &&
                    grapher.highlightToggle && (
                        <HighlightToggle
                            grapher={grapher}
                            highlightToggle={grapher.highlightToggle}
                        />
                    )}
                {grapher.currentTab === GrapherTabOption.chart &&
                    grapher.isScatter &&
                    grapher.table.hasSelection && (
                        <ZoomToggle grapher={grapher} />
                    )}

                {(grapher.currentTab === GrapherTabOption.table ||
                    grapher.isScatter) &&
                    grapher.hasCountriesSmallerThanFilterOption && (
                        <FilterSmallCountriesToggle grapher={grapher} />
                    )}

                {grapher.currentTab === GrapherTabOption.chart &&
                    grapher.canToggleRelativeMode && (
                        <AbsRelToggle grapher={grapher} />
                    )}
            </div>
        )
    }

    @computed private get timeline() {
        const grapher = this.grapher

        if (!grapher.hasTimeline) return null

        const props: TimelineComponentProps = {
            manager: grapher,
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
        const { grapher } = this
        const {
            isShareMenuActive,
            hasInlineControls,
            hasSpace,
            hasRelatedQuestion,
            relatedQuestions,
        } = grapher

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
            <ShareMenu grapher={grapher} onDismiss={this.onShareMenu} />
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
                style={{ height: grapher.footerHeight }}
            >
                {this.timeline}
                {inlineControlsElement}
                {tabsElement}
                {shareMenuElement}
                {relatedQuestionElement}
            </div>
        )
    }
}
