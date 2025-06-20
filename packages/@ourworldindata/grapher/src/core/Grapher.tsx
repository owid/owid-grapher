import * as _ from "lodash-es"
import React from "react"

import {
    observable,
    computed,
    action,
    autorun,
    reaction,
    makeObservable,
} from "mobx"
import {
    bind,
    next,
    sampleFrom,
    exposeInstanceOnWindow,
    QueryParams,
    MultipleOwidVariableDataDimensionsMap,
    Bounds,
    strToQueryParams,
    queryParamsToStr,
    setWindowQueryStr,
} from "@ourworldindata/utils"
import { BodyDiv } from "@ourworldindata/components"
import {
    ScaleType,
    AnnotationFieldsInTitle,
    GrapherInterface,
    LegacyGrapherInterface,
    DetailDictionary,
    GrapherTooltipAnchor,
    NarrativeChartInfo,
    ArchiveContext,
    AdditionalGrapherDataFetchFn,
    GrapherVariant,
    Time,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import {
    GRAPHER_LOADED_EVENT_NAME,
    GrapherModal,
} from "../core/GrapherConstants"

import { FullScreen } from "../fullScreen/FullScreen"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import { TooltipContainer } from "../tooltip/Tooltip"
import { EntitySelectorModal } from "../modal/EntitySelectorModal"
import { DownloadModal } from "../modal/DownloadModal"
import { observer } from "mobx-react"
import "d3-transition"
import { SourcesModal } from "../modal/SourcesModal"
import { Command, CommandPalette } from "../controls/CommandPalette"
import { EmbedModal } from "../modal/EmbedModal"
import Mousetrap from "mousetrap"
import { SelectionArray } from "../selection/SelectionArray"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable"
import classnames from "classnames"
import { SidePanel } from "../sidePanel/SidePanel"
import { EntitySelector } from "../entitySelector/EntitySelector"
import { SlideInDrawer } from "../slideInDrawer/SlideInDrawer"
import { FocusArray } from "../focus/FocusArray"
import { Chart } from "../chart/Chart.js"
import { flushSync } from "react-dom"
import { GrapherState } from "./GrapherState.js"

declare global {
    interface Window {
        details?: DetailDictionary
        admin?: any // TODO: use stricter type
    }
}

export const DEFAULT_MS_PER_TICK = 100

// Exactly the same as GrapherInterface, but contains options that developers want but authors won't be touching.
export interface GrapherProgrammaticInterface extends GrapherInterface {
    queryStr?: string
    bounds?: Bounds
    table?: OwidTable
    bakedGrapherURL?: string
    adminBaseUrl?: string
    env?: string
    highlightedTimesInLineChart?: Time[]
    baseFontSize?: number
    staticBounds?: Bounds
    variant?: GrapherVariant
    isDisplayedAlongsideComplementaryTable?: boolean

    hideTitle?: boolean
    hideSubtitle?: boolean
    hideNote?: boolean
    hideOriginUrl?: boolean

    hideEntityControls?: boolean
    hideZoomToggle?: boolean
    hideNoDataAreaToggle?: boolean
    hideFacetYDomainToggle?: boolean
    hideXScaleToggle?: boolean
    hideYScaleToggle?: boolean
    hideMapRegionDropdown?: boolean
    forceHideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    hasTableTab?: boolean
    hideChartTabs?: boolean
    hideShareButton?: boolean
    hideExploreTheDataButton?: boolean
    hideRelatedQuestion?: boolean
    isSocialMediaExport?: boolean
    enableMapSelection?: boolean

    enableKeyboardShortcuts?: boolean
    bindUrlToWindow?: boolean
    isEmbeddedInAnOwidPage?: boolean
    isEmbeddedInADataPage?: boolean
    isConfigReady?: boolean
    canHideExternalControlsInEmbed?: boolean

    narrativeChartInfo?: MinimalNarrativeChartInfo
    archiveContext?: ArchiveContext

    manager?: GrapherManager
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
}

export type MinimalNarrativeChartInfo = Pick<
    NarrativeChartInfo,
    "name" | "parentChartSlug" | "queryParamsForParentChart"
>

interface AnalyticsContext {
    mdimSlug?: string
    mdimViewConfigId?: string
}

export interface GrapherManager {
    canonicalUrl?: string
    selection?: SelectionArray
    focusArray?: FocusArray
    adminEditPath?: string
    adminCreateNarrativeChartPath?: string
    analyticsContext?: AnalyticsContext
}

export interface GrapherProps {
    grapherState: GrapherState
}

@observer
export class Grapher extends React.Component<GrapherProps> {
    @computed get grapherState(): GrapherState {
        return this.props.grapherState
    }

    // #region Observable props not in any interface

    // stored on Grapher so state is preserved when switching to full-screen mode

    private legacyVariableDataJson:
        | MultipleOwidVariableDataDimensionsMap
        | undefined = undefined
    private hasLoggedGAViewEvent = false
    private hasBeenVisible = false
    private uncaughtError: Error | undefined = undefined

    constructor(props: { grapherState: GrapherState }) {
        super(props)

        makeObservable<
            Grapher,
            "legacyVariableDataJson" | "hasBeenVisible" | "uncaughtError"
        >(this, {
            legacyVariableDataJson: observable,
            hasBeenVisible: observable,
            uncaughtError: observable,
        })
    }

    // Convenience method for debugging
    windowQueryParams(str = location.search): QueryParams {
        return strToQueryParams(str)
    }

    @action.bound private _setInputTable(
        json: MultipleOwidVariableDataDimensionsMap,
        legacyConfig: Partial<LegacyGrapherInterface>
    ): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files

        const startMark = performance.now()
        const tableWithColors = legacyToOwidTableAndDimensionsWithMandatorySlug(
            json,
            legacyConfig.dimensions ?? [],
            legacyConfig.selectedEntityColors
        )
        this.grapherState.createPerformanceMeasurement(
            "legacyToOwidTableAndDimensions",
            startMark
        )

        this.grapherState.inputTable = tableWithColors
    }

    @action rebuildInputOwidTable(): void {
        // TODO grapher model: switch this to downloading multiple data and metadata files
        if (!this.legacyVariableDataJson) return
        this._setInputTable(
            this.legacyVariableDataJson,
            this.grapherState.legacyConfigAsAuthored
        )
    }

    // Keeps a running cache of series colors at the Grapher level.

    @bind dispose(): void {
        this.grapherState.disposers.forEach((dispose) => dispose())
    }

    @action.bound setError(err: Error): void {
        this.uncaughtError = err
    }

    @action.bound clearErrors(): void {
        this.uncaughtError = undefined
    }

    private get commandPalette(): React.ReactElement | null {
        return this.props.grapherState.enableKeyboardShortcuts ? (
            <CommandPalette commands={this.keyboardShortcuts} display="none" />
        ) : null
    }

    @action.bound private toggleTabCommand(): void {
        this.grapherState.setTab(
            next(this.grapherState.availableTabs, this.grapherState.activeTab)
        )
    }

    @action.bound private togglePlayingCommand(): void {
        void this.grapherState.timelineController.togglePlay()
    }

    private get keyboardShortcuts(): Command[] {
        const temporaryFacetTestCommands = _.range(0, 10).map((num) => {
            return {
                combo: `${num}`,
                fn: (): void => this.randomSelection(num),
            }
        })
        const shortcuts = [
            ...temporaryFacetTestCommands,
            {
                combo: "t",
                fn: (): void => this.toggleTabCommand(),
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "?",
                fn: (): void => CommandPalette.togglePalette(),
                title: `Toggle Help`,
                category: "Navigation",
            },
            {
                combo: "a",
                fn: (): void => {
                    if (this.grapherState.selection.hasSelection) {
                        this.grapherState.selection.clearSelection()
                        this.grapherState.focusArray.clear()
                    } else {
                        this.grapherState.selection.setSelectedEntities(
                            this.grapherState.availableEntityNames
                        )
                    }
                },
                title: this.grapherState.selection.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: (): void => {
                    this.grapherState.hideFacetControl =
                        !this.grapherState.hideFacetControl
                },
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "p",
                fn: (): void => this.togglePlayingCommand(),
                title: this.grapherState.isPlaying ? `Pause` : `Play`,
                category: "Timeline",
            },
            {
                combo: "l",
                fn: (): void => this.toggleYScaleTypeCommand(),
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "w",
                fn: (): void => this.toggleFullScreenMode(),
                title: `Toggle full-screen mode`,
                category: "Chart",
            },
            {
                combo: "s",
                fn: (): void => {
                    const isSourcesModalOpen =
                        this.grapherState.activeModal === GrapherModal.Sources
                    this.grapherState.activeModal = isSourcesModalOpen
                        ? undefined
                        : GrapherModal.Sources
                },
                title: `Toggle sources modal`,
                category: "Chart",
            },
            {
                combo: "d",
                fn: (): void => {
                    const isDownloadModalOpen =
                        this.grapherState.activeModal === GrapherModal.Download
                    this.grapherState.activeModal = isDownloadModalOpen
                        ? undefined
                        : GrapherModal.Download
                },
                title: "Toggle download modal",
                category: "Chart",
            },
            { combo: "esc", fn: (): void => this.clearErrors() },
            {
                combo: "z",
                fn: (): void => this.toggleTimelineCommand(),
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "shift+o",
                fn: (): void => this.grapherState.clearQueryParams(),
                title: "Reset to original",
                category: "Navigation",
            },
            {
                combo: "g",
                fn: (): void => this.grapherState.globeController.toggleGlobe(),
                title: "Toggle globe view",
                category: "Map",
            },
        ]

        if (this.grapherState.slideShow) {
            const slideShow = this.grapherState.slideShow
            shortcuts.push({
                combo: "right",
                fn: () => slideShow.playNext(),
                title: "Next chart",
                category: "Browse",
            })
            shortcuts.push({
                combo: "left",
                fn: () => slideShow.playPrevious(),
                title: "Previous chart",
                category: "Browse",
            })
        }

        return shortcuts
    }

    @action.bound private toggleTimelineCommand(): void {
        // Todo: add tests for this
        this.grapherState.setTimeFromTimeQueryParam(
            next(["latest", "earliest", ".."], this.grapherState.timeParam!)
        )
    }

    @action.bound private toggleYScaleTypeCommand(): void {
        this.grapherState.yAxis.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.grapherState.yAxis.scaleType
        )
    }

    @action.bound randomSelection(num: number): void {
        // Continent, Population, GDP PC, GDP, PopDens, UN, Language, etc.
        this.clearErrors()
        const currentSelection =
            this.grapherState.selection.selectedEntityNames.length
        const newNum = num ? num : currentSelection ? currentSelection * 2 : 10
        this.grapherState.selection.setSelectedEntities(
            sampleFrom(
                this.grapherState.availableEntityNames,
                newNum,
                Date.now()
            )
        )
    }
    @action.bound toggleFullScreenMode(): void {
        this.grapherState.isInFullScreenMode =
            !this.grapherState.isInFullScreenMode
    }

    @action.bound dismissFullScreen(): void {
        // if a modal is open, dismiss it instead of exiting full-screen mode
        if (
            this.grapherState.isModalOpen ||
            this.grapherState.isShareMenuActive
        ) {
            this.grapherState.isEntitySelectorModalOrDrawerOpen = false
            this.grapherState.activeModal = undefined
            this.grapherState.isShareMenuActive = false
        } else {
            this.grapherState.isInFullScreenMode = false
        }
    }

    private renderError(): React.ReactElement {
        return (
            <div
                title={this.uncaughtError?.message}
                style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    textAlign: "center",
                    lineHeight: 1.5,
                    padding: "48px",
                }}
            >
                <p style={{ color: "#cc0000", fontWeight: 700 }}>
                    <FontAwesomeIcon icon={faExclamationTriangle} />
                    There was a problem loading this chart
                </p>
                <p>
                    We have been notified of this error, please check back later
                    whether it's been fixed. If the error persists, get in touch
                    with us at{" "}
                    <a
                        href={`mailto:info@ourworldindata.org?subject=Broken chart on page ${window.location.href}`}
                    >
                        info@ourworldindata.org
                    </a>
                    .
                </p>
                {this.uncaughtError && this.uncaughtError.message && (
                    <pre style={{ fontSize: "11px" }}>
                        Error: {this.uncaughtError.message}
                    </pre>
                )}
            </div>
        )
    }

    private renderGrapherComponent(): React.ReactElement {
        const containerClasses = classnames({
            GrapherComponent: true,
            GrapherPortraitClass: this.grapherState.isPortrait,
            isStatic: this.grapherState.isStatic,
            isExportingToSvgOrPng: this.grapherState.isExportingToSvgOrPng,
            GrapherComponentNarrow: this.grapherState.isNarrow,
            GrapherComponentSemiNarrow: this.grapherState.isSemiNarrow,
            GrapherComponentSmall: this.grapherState.isSmall,
            GrapherComponentMedium: this.grapherState.isMedium,
        })

        const containerStyle = {
            width: this.grapherState.activeBounds.width,
            height: this.grapherState.activeBounds.height,
            fontSize: this.grapherState.isExportingToSvgOrPng
                ? 18
                : Math.min(16, this.grapherState.fontSize), // cap font size at 16px
        }

        return (
            <div
                ref={this.grapherState.base}
                className={containerClasses}
                style={containerStyle}
                data-grapher-url={JSON.stringify({
                    grapherUrl: this.grapherState.canonicalUrl,
                    narrativeChartName:
                        this.grapherState.narrativeChartInfo?.name,
                })}
            >
                {this.commandPalette}
                {this.uncaughtError ? this.renderError() : this.renderReady()}
            </div>
        )
    }

    override render(): React.ReactElement | undefined {
        // Used in the admin to render a static preview of the chart
        if (this.grapherState.isExportingToSvgOrPng)
            return <Chart manager={this.grapherState} />

        if (this.grapherState.isInFullScreenMode) {
            return (
                <FullScreen
                    onDismiss={this.dismissFullScreen}
                    overlayColor={
                        this.grapherState.isModalOpen ? "#999999" : "#fff"
                    }
                >
                    {this.renderGrapherComponent()}
                </FullScreen>
            )
        }

        return this.renderGrapherComponent()
    }

    private renderReady(): React.ReactElement | null {
        if (!this.hasBeenVisible) return null

        const entitySelectorArray = this.grapherState.isOnMapTab
            ? this.grapherState.mapConfig.selection
            : this.grapherState.selection

        return (
            <>
                {/* Chart and entity selector */}
                <div className="CaptionedChartAndSidePanel">
                    <Chart manager={this.grapherState} />

                    {this.grapherState.sidePanelBounds && (
                        <SidePanel bounds={this.grapherState.sidePanelBounds}>
                            <EntitySelector
                                manager={this.grapherState}
                                selection={entitySelectorArray}
                            />
                        </SidePanel>
                    )}
                </div>

                {/* Modals */}
                {this.grapherState.activeModal === GrapherModal.Sources &&
                    this.grapherState.isReady && (
                        <SourcesModal manager={this.grapherState} />
                    )}
                {this.grapherState.activeModal === GrapherModal.Download &&
                    this.grapherState.isReady && (
                        <DownloadModal manager={this.grapherState} />
                    )}
                {this.grapherState.activeModal === GrapherModal.Embed &&
                    this.grapherState.isReady && (
                        <EmbedModal manager={this.grapherState} />
                    )}
                {this.grapherState.isEntitySelectorModalOpen && (
                    <EntitySelectorModal
                        manager={this.grapherState}
                        selection={entitySelectorArray}
                    />
                )}

                {/* Entity selector in a slide-in drawer */}
                <SlideInDrawer
                    grapherRef={this.grapherState.base}
                    active={this.grapherState.isEntitySelectorDrawerOpen}
                    toggle={() => {
                        this.grapherState.isEntitySelectorModalOrDrawerOpen =
                            !this.grapherState.isEntitySelectorModalOrDrawerOpen
                    }}
                >
                    <EntitySelector
                        manager={this.grapherState}
                        selection={entitySelectorArray}
                        autoFocus={true}
                    />
                </SlideInDrawer>

                {/* Tooltip: either pin to the bottom or render into the chart area */}
                {this.grapherState.shouldPinTooltipToBottom ? (
                    <BodyDiv>
                        <TooltipContainer
                            tooltipProvider={this.grapherState}
                            anchor={GrapherTooltipAnchor.bottom}
                        />
                    </BodyDiv>
                ) : (
                    <TooltipContainer
                        tooltipProvider={this.grapherState}
                        containerWidth={
                            this.grapherState.captionedChartBounds.width
                        }
                        containerHeight={
                            this.grapherState.captionedChartBounds.height
                        }
                    />
                )}
            </>
        )
    }

    // Chart should only render SVG when it's on the screen
    @action.bound private setUpIntersectionObserver(): void {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            // We need to render this immediately to avoid a Safari bug, where Safari
                            // is seemingly blocking rendering during the initial fetches, and will then
                            // subsequently render using the wrong bounds.
                            flushSync(() => {
                                this.hasBeenVisible = true
                            })

                            if (!this.hasLoggedGAViewEvent) {
                                this.hasLoggedGAViewEvent = true

                                if (this.grapherState.narrativeChartInfo) {
                                    this.grapherState.analytics.logGrapherView(
                                        this.grapherState.narrativeChartInfo
                                            .parentChartSlug,
                                        {
                                            narrativeChartName:
                                                this.grapherState
                                                    .narrativeChartInfo.name,
                                        }
                                    )
                                    this.hasLoggedGAViewEvent = true
                                } else if (this.grapherState.slug) {
                                    this.grapherState.analytics.logGrapherView(
                                        this.grapherState.slug
                                    )
                                    this.hasLoggedGAViewEvent = true
                                }
                            }

                            // dismiss tooltip when less than 2/3 of the chart is visible
                            const tooltip = this.grapherState.tooltip?.get()
                            const isNotVisible = !entry.isIntersecting
                            const isPartiallyVisible =
                                entry.isIntersecting &&
                                entry.intersectionRatio < 0.66
                            if (
                                tooltip &&
                                (isNotVisible || isPartiallyVisible)
                            ) {
                                tooltip.dismiss?.()
                            }
                        }
                    })
                },
                { threshold: [0, 0.66] }
            )
            observer.observe(this.grapherState.containerElement!)
            this.grapherState.disposers.push(() => observer.disconnect())
        } else {
            // IntersectionObserver not available; we may be in a Node environment, just render
            this.hasBeenVisible = true
        }
    }

    @action.bound private setBaseFontSize(): void {
        this.grapherState.baseFontSize =
            this.grapherState.computeBaseFontSizeFromWidth(
                this.grapherState.captionedChartBounds
            )
    }

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    private bindToWindow(): void {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = (): void =>
            setWindowQueryStr(queryParamsToStr(this.grapherState.changedParams))
        const debouncedPushParams = _.debounce(pushParams, 100)

        reaction(
            () => this.grapherState.changedParams,
            () => (this.debounceMode ? debouncedPushParams() : pushParams())
        )

        autorun(() => (document.title = this.grapherState.currentTitle))
    }

    @action.bound private setUpWindowResizeEventHandler(): void {
        const updateWindowDimensions = (): void => {
            this.grapherState.windowInnerWidth = window.innerWidth
            this.grapherState.windowInnerHeight = window.innerHeight
        }
        const onResize = _.debounce(updateWindowDimensions, 400, {
            leading: true,
        })

        if (typeof window !== "undefined") {
            updateWindowDimensions()
            window.addEventListener("resize", onResize)
            this.grapherState.disposers.push(() => {
                window.removeEventListener("resize", onResize)
            })
        }
    }

    override componentDidMount(): void {
        this.setBaseFontSize()
        this.setUpIntersectionObserver()
        this.setUpWindowResizeEventHandler()
        exposeInstanceOnWindow(this, "grapher")
        // Emit a custom event when the grapher is ready
        // We can use this in global scripts that depend on the grapher e.g. the site-screenshots tool
        this.grapherState.disposers.push(
            reaction(
                () => this.grapherState.isReady,
                () => {
                    if (this.grapherState.isReady) {
                        document.dispatchEvent(
                            new CustomEvent(GRAPHER_LOADED_EVENT_NAME, {
                                detail: { grapher: this },
                            })
                        )
                    }
                }
            ),
            reaction(
                () => this.grapherState.facetStrategy,
                () => this.grapherState.focusArray.clear()
            )
        )
        if (this.grapherState.bindUrlToWindow) this.bindToWindow()
        if (this.grapherState.enableKeyboardShortcuts)
            this.bindKeyboardShortcuts()
    }

    private _shortcutsBound = false
    private bindKeyboardShortcuts(): void {
        if (this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.bind(shortcut.combo, () => {
                shortcut.fn()
                this.grapherState.analytics.logKeyboardShortcut(
                    shortcut.title || "",
                    shortcut.combo
                )
                return false
            })
        })
        this._shortcutsBound = true
    }

    private unbindKeyboardShortcuts(): void {
        if (!this._shortcutsBound) return
        this.keyboardShortcuts.forEach((shortcut) => {
            Mousetrap.unbind(shortcut.combo)
        })
        this._shortcutsBound = false
    }

    override componentWillUnmount(): void {
        this.unbindKeyboardShortcuts()
        this.dispose()
    }

    override componentDidUpdate(): void {
        this.setBaseFontSize()
    }

    override componentDidCatch(error: Error): void {
        this.setError(error)
        this.grapherState.analytics.logGrapherViewError(error)
    }

    debounceMode = false
}
