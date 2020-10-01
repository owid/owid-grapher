import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import {
    getQueryParams,
    getWindowQueryParams,
    QueryParams,
} from "utils/client/url"
import {
    TimelineComponent,
    TimelineComponentManager,
} from "grapher/timeline/TimelineComponent"
import { formatValue } from "grapher/utils/Util"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import {
    GrapherTabOption,
    HighlightToggleConfig,
    RelatedQuestionsConfig,
    StackMode,
} from "grapher/core/GrapherConstants"
import { ShareMenu, ShareMenuManager } from "./ShareMenu"
import { OwidTable } from "coreTable/OwidTable"

export interface HighlightToggleManager {
    highlightToggle?: HighlightToggleConfig
    table: OwidTable
    populateFromQueryParams: (obj: QueryParams) => void
}

// Todo: Add tests and stories
@observer
export class HighlightToggle extends React.Component<{
    manager: HighlightToggleManager
}> {
    @computed private get manager() {
        return this.props.manager
    }
    @computed private get highlight() {
        return this.props.manager.highlightToggle
    }

    @computed private get highlightParams() {
        return getQueryParams((this.highlight?.paramStr || "").substring(1))
    }

    @action.bound private onHighlightToggle(
        event: React.FormEvent<HTMLInputElement>
    ) {
        if (!event.currentTarget.checked) {
            this.manager.table.clearSelection()
            return
        }

        const params = {
            ...getWindowQueryParams(),
            ...this.highlightParams,
        }
        this.manager.populateFromQueryParams(params)
    }

    private get isHighlightActive() {
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
                &nbsp;{highlight?.description}
            </label>
        )
    }
}

export interface AbsRelToggleManager {
    stackMode?: StackMode
    relativeToggleLabel?: string
}

@observer
export class AbsRelToggle extends React.Component<{
    manager: AbsRelToggleManager
}> {
    @action.bound onToggle() {
        this.manager.stackMode = this.isRelativeMode
            ? StackMode.absolute
            : StackMode.relative
    }

    @computed get isRelativeMode() {
        return this.manager.stackMode === StackMode.relative
    }

    @computed get manager() {
        return this.props.manager
    }

    render() {
        const label = this.manager.relativeToggleLabel ?? "Relative"
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.isRelativeMode}
                    onChange={this.onToggle}
                    data-track-note="chart-abs-rel-toggle"
                />{" "}
                &nbsp;{label}
            </label>
        )
    }
}

export interface ZoomToggleManager {
    zoomToSelection?: boolean
}

@observer
export class ZoomToggle extends React.Component<{
    manager: ZoomToggleManager
}> {
    @action.bound onToggle() {
        this.props.manager.zoomToSelection = this.props.manager.zoomToSelection
            ? undefined
            : true
    }

    render() {
        const label = "Zoom to selection"
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.props.manager.zoomToSelection}
                    onChange={this.onToggle}
                    data-track-note="chart-zoom-to-selection"
                />{" "}
                {label}
            </label>
        )
    }
}

export interface SmallCountriesFilterManager {
    populationFilterOption?: number
    minPopulationFilter?: number
}

@observer
export class FilterSmallCountriesToggle extends React.Component<{
    manager: SmallCountriesFilterManager
}> {
    @action.bound private onChange() {
        this.manager.minPopulationFilter = this.manager.minPopulationFilter
            ? undefined
            : this.filterOption
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed private get filterOption() {
        return this.manager.populationFilterOption ?? 1e6
    }

    render() {
        const label = `Hide countries < ${formatValue(
            this.filterOption,
            {}
        )} people`
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={!!this.manager.minPopulationFilter}
                    onChange={this.onChange}
                    data-track-note="chart-filter-small-countries"
                />{" "}
                &nbsp;{label}
            </label>
        )
    }
}

export interface FooterControlsManager
    extends ShareMenuManager,
        TimelineComponentManager {
    isShareMenuActive?: boolean
    isSelectingData?: boolean
    availableTabs?: GrapherTabOption[]
    currentTab?: GrapherTabOption
    isEmbed?: boolean
    canonicalUrl?: string
    hasTimeline?: boolean
    hasRelatedQuestion?: boolean
    relatedQuestions: RelatedQuestionsConfig[]
    footerHeight?: number
}

@observer
export class FooterControls extends React.Component<{
    manager: FooterControlsManager
}> {
    @computed private get manager() {
        return this.props.manager
    }

    @action.bound onShareMenu() {
        this.manager.isShareMenuActive = !this.manager.isShareMenuActive
    }

    @action.bound onDataSelect() {
        this.manager.isSelectingData = true
    }

    @computed private get availableTabs() {
        return this.manager.availableTabs || []
    }

    private _getTabsElement() {
        const { manager } = this
        return (
            <nav className="tabs">
                <ul>
                    {this.availableTabs.map((tabName) => {
                        return (
                            tabName !== GrapherTabOption.download && (
                                <li
                                    key={tabName}
                                    className={
                                        "tab clickable" +
                                        (tabName === manager.currentTab
                                            ? " active"
                                            : "")
                                    }
                                    onClick={() =>
                                        (manager.currentTab = tabName)
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
                            (manager.currentTab === GrapherTabOption.download
                                ? " active"
                                : "")
                        }
                        data-track-note="chart-click-download"
                        onClick={() =>
                            (manager.currentTab = GrapherTabOption.download)
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
                    {manager.isEmbed && (
                        <li className="clickable icon">
                            <a
                                title="Open chart in new tab"
                                href={manager.canonicalUrl}
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
        const manager = this.manager
        if (!manager.hasTimeline) return null

        return (
            <div className="footerRowSingle">
                <TimelineComponent manager={manager} />
            </div>
        )
    }

    render() {
        const { manager } = this
        const {
            isShareMenuActive,
            hasRelatedQuestion,
            relatedQuestions,
        } = manager
        const tabsElement = (
            <div className="footerRowSingle">{this._getTabsElement()}</div>
        )

        const shareMenuElement = isShareMenuActive && (
            <ShareMenu manager={manager} onDismiss={this.onShareMenu} />
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
                style={{ height: manager.footerHeight ?? 1 }}
            >
                {this.timeline}
                {tabsElement}
                {shareMenuElement}
                {relatedQuestionElement}
            </div>
        )
    }
}
