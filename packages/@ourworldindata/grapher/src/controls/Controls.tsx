import React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { TimelineComponent } from "../timeline/TimelineComponent"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faDownload } from "@fortawesome/free-solid-svg-icons/faDownload"
import { faShareAlt } from "@fortawesome/free-solid-svg-icons/faShareAlt"
import { faExpand } from "@fortawesome/free-solid-svg-icons/faExpand"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"
import { faChevronDown } from "@fortawesome/free-solid-svg-icons/faChevronDown"
import {
    FacetAxisDomain,
    FacetStrategy,
    GrapherTabOption,
    RelatedQuestionsConfig,
    StackMode,
} from "../core/GrapherConstants"
import { ShareMenu, ShareMenuManager } from "./ShareMenu"
import { TimelineController } from "../timeline/TimelineController"
import { AxisConfig } from "../axis/AxisConfig"
import { Tippy } from "../chart/Tippy"
import { Bounds } from "@ourworldindata/utils"
import classnames from "classnames"

export interface NoDataAreaToggleManager {
    showNoDataArea?: boolean
}

@observer
export class NoDataAreaToggle extends React.Component<{
    manager: NoDataAreaToggleManager
}> {
    @action.bound onToggle(): void {
        this.manager.showNoDataArea = !this.manager.showNoDataArea
    }

    @computed get manager(): NoDataAreaToggleManager {
        return this.props.manager
    }

    render(): JSX.Element {
        const label = "Show 'no data' area"
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.manager.showNoDataArea}
                    onChange={this.onToggle}
                    data-track-note="chart-no-data-area-toggle"
                />{" "}
                &nbsp;{label}
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
    @action.bound onToggle(): void {
        this.manager.stackMode = this.isRelativeMode
            ? StackMode.absolute
            : StackMode.relative
    }

    @computed get isRelativeMode(): boolean {
        return this.manager.stackMode === StackMode.relative
    }

    @computed get manager(): AbsRelToggleManager {
        return this.props.manager
    }

    render(): JSX.Element {
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

export interface FacetYDomainToggleManager {
    yAxis?: AxisConfig
}

@observer
export class FacetYDomainToggle extends React.Component<{
    manager: FacetYDomainToggleManager
}> {
    @action.bound onToggle(): void {
        this.props.manager.yAxis!.facetDomain = this.isYDomainShared
            ? FacetAxisDomain.independent
            : FacetAxisDomain.shared
    }

    @computed get isYDomainShared(): boolean {
        const facetDomain =
            this.props.manager.yAxis!.facetDomain || FacetAxisDomain.shared
        return facetDomain === FacetAxisDomain.shared
    }

    render(): JSX.Element {
        return (
            <label className="clickable">
                <input
                    type="checkbox"
                    checked={this.isYDomainShared}
                    onChange={this.onToggle}
                    data-track-note="chart-facet-ydomain-toggle"
                />{" "}
                &nbsp;Align axis scales
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
    @action.bound onToggle(): void {
        this.props.manager.zoomToSelection = this.props.manager.zoomToSelection
            ? undefined
            : true
    }

    render(): JSX.Element {
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

export interface FacetStrategyDropdownManager {
    availableFacetStrategies: FacetStrategy[]
    facetStrategy?: FacetStrategy
    hideFacetControl?: boolean
    entityType?: string
}

// A drop-down button that, when clicked, shows a hovering visual display
// indicating the faceting options.
@observer
export class FacetStrategyDropdown extends React.Component<{
    manager: FacetStrategyDropdownManager
}> {
    render(): JSX.Element {
        return (
            <Tippy
                content={this.content}
                interactive={true}
                trigger={"click"}
                placement={"bottom-start"}
                arrow={false}
            >
                <div
                    className="FacetStrategyDropdown"
                    style={{ width: this.dropDownWidth }}
                >
                    {this.facetStrategyLabels[this.facetStrategy]}
                    <div>
                        <FontAwesomeIcon icon={faChevronDown} />
                    </div>
                </div>
            </Tippy>
        )
    }

    @computed get facetStrategyLabels(): { [key in FacetStrategy]: string } {
        // arbitrary entity names can be too long for our current design; as a trade-off,
        // we accept them only if they are not too long, otherwise we just use "item"
        const entityType = this.props.manager.entityType ?? "country"
        const entityLabel =
            entityType.length > "country".length ? "item" : entityType

        return {
            [FacetStrategy.none]: "All together",
            [FacetStrategy.entity]: `Split by ${entityLabel}`,
            [FacetStrategy.metric]: "Split by metric",
        }
    }

    @computed get strategies(): FacetStrategy[] {
        return (
            this.props.manager.availableFacetStrategies || [
                FacetStrategy.none,
                FacetStrategy.entity,
                FacetStrategy.metric,
            ]
        )
    }

    @computed get dropDownWidth(): string {
        const maxWidth = Math.max(
            ...this.strategies.map(
                (s) =>
                    Bounds.forText(this.facetStrategyLabels[s], {
                        fontSize: 12,
                    }).width
            )
        )
        return `${maxWidth + 45}px` // leave room for the chevron
    }

    // A hovering visual display giving options to be selected from
    @computed get content(): JSX.Element {
        const parts = this.strategies.map((value: FacetStrategy) => {
            const label = this.facetStrategyLabels[value]
            const children =
                value === FacetStrategy.none ? (
                    // a single solid block
                    <div className="FacetStrategyPreview-none-child"></div>
                ) : (
                    // a 3x2 grid of squares
                    <>
                        <div className="FacetStrategyPreview-split-child"></div>
                        <div className="FacetStrategyPreview-split-child"></div>
                        <div className="FacetStrategyPreview-split-child"></div>
                        <div className="FacetStrategyPreview-split-child"></div>
                        <div className="FacetStrategyPreview-split-child"></div>
                        <div className="FacetStrategyPreview-split-child"></div>
                    </>
                )
            return (
                <div
                    className={classnames({
                        FacetStrategyOption: true,
                        selected: value === this.facetStrategy,
                    })}
                    key={value.toString()}
                >
                    <a
                        onClick={(): void => {
                            this.props.manager.facetStrategy = value
                        }}
                    >
                        <div className="FacetStrategyLabel">{label}</div>
                        <div className={`FacetStrategyPreview-parent`}>
                            {children}
                        </div>
                    </a>
                </div>
            )
        })
        return <div className="FacetStrategyFloat">{parts}</div>
    }

    @computed get facetStrategy(): FacetStrategy {
        return this.props.manager.facetStrategy || FacetStrategy.none
    }
}

export interface FooterControlsManager extends ShareMenuManager {
    isShareMenuActive?: boolean
    isSelectingData?: boolean
    availableTabs?: GrapherTabOption[]
    currentTab?: GrapherTabOption
    isInIFrame?: boolean
    canonicalUrl?: string
    showTimeline?: boolean
    hasRelatedQuestion?: boolean
    isRelatedQuestionTargetDifferentFromCurrentPage?: boolean
    relatedQuestions: RelatedQuestionsConfig[]
    footerControlsHeight?: number
    timelineController?: TimelineController
}

@observer
export class FooterControls extends React.Component<{
    manager: FooterControlsManager
}> {
    @computed private get manager(): FooterControlsManager {
        return this.props.manager
    }

    @action.bound onShareMenu(): void {
        this.manager.isShareMenuActive = !this.manager.isShareMenuActive
    }

    @computed private get availableTabs(): GrapherTabOption[] {
        return this.manager.availableTabs || []
    }

    private _getTabsElement(): JSX.Element {
        const { manager } = this
        return (
            <nav className="tabs">
                <ul>
                    {this.availableTabs.map((tabName) => {
                        return tabName !== GrapherTabOption.download ? (
                            <li
                                key={tabName}
                                className={
                                    "tab clickable" +
                                    (tabName === manager.currentTab
                                        ? " active"
                                        : "")
                                }
                            >
                                <a
                                    onClick={(): void => {
                                        manager.currentTab = tabName
                                    }}
                                    data-track-note={"chart-click-" + tabName}
                                >
                                    {tabName}
                                </a>
                            </li>
                        ) : null
                    })}
                    <li
                        className={
                            "tab clickable icon download-tab-button" +
                            (manager.currentTab === GrapherTabOption.download
                                ? " active"
                                : "")
                        }
                        title="Download as .png or .svg"
                    >
                        <a
                            data-track-note="chart-click-download"
                            onClick={(): GrapherTabOption =>
                                (manager.currentTab = GrapherTabOption.download)
                            }
                        >
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
                    {manager.isInIFrame && (
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

    render(): JSX.Element {
        const { manager } = this
        const {
            isShareMenuActive,
            hasRelatedQuestion,
            isRelatedQuestionTargetDifferentFromCurrentPage,
            relatedQuestions,
        } = manager
        const tabsElement = (
            <div className="footerRowSingle">{this._getTabsElement()}</div>
        )

        const shareMenuElement = isShareMenuActive && (
            <ShareMenu manager={manager} onDismiss={this.onShareMenu} />
        )

        const relatedQuestionElement = relatedQuestions &&
            hasRelatedQuestion &&
            isRelatedQuestionTargetDifferentFromCurrentPage && (
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

        const timeline = manager.showTimeline ? (
            <div className="footerRowSingle">
                <TimelineComponent
                    timelineController={this.manager.timelineController!}
                />
            </div>
        ) : null

        return (
            <div
                className={"ControlsFooter"}
                style={{ height: manager.footerControlsHeight ?? 1 }}
            >
                {timeline}
                {tabsElement}
                {shareMenuElement}
                {relatedQuestionElement}
            </div>
        )
    }
}
