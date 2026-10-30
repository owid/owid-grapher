import * as _ from "lodash-es"
import React from "react"

import {
    observable,
    computed,
    action,
    autorun,
    reaction,
    makeObservable,
    comparer,
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
import { BodyPortal } from "@ourworldindata/components"
import {
    ScaleType,
    AnnotationFieldsInTitle,
    GrapherInterface,
    LegacyGrapherInterface,
    GrapherTooltipAnchor,
    NarrativeChartInfo,
    ArchiveContext,
    AdditionalGrapherDataFetchFn,
    GrapherVariant,
    Time,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import { GrapherModal } from "../core/GrapherConstants"

import { FullScreen } from "../fullScreen/FullScreen"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons"
import { TooltipContainer } from "../tooltip/Tooltip"
import { EntitySelectorModal } from "../modal/EntitySelectorModal"
import { DownloadModal } from "../modal/DownloadModal"
import { observer } from "mobx-react"
import { SourcesModal } from "../modal/SourcesModal"
import { Command, CommandPalette } from "../controls/CommandPalette"
import { EmbedModal } from "../modal/EmbedModal"
import { tinykeys } from "tinykeys"
import { SelectionArray } from "../selection/SelectionArray"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable"
import classnames from "clsx"
import { SidePanel } from "../sidePanel/SidePanel"
import { EntitySelector } from "../entitySelector/EntitySelector"
import { SlideInDrawer } from "../slideInDrawer/SlideInDrawer"
import { FocusArray } from "../focus/FocusArray"
import { Chart } from "../chart/Chart.js"
import { flushSync } from "react-dom"
import { GrapherState } from "./GrapherState.js"

/**
 * A Grapher config plus options that aren't part of the persisted config
 * schema: they control how a chart is embedded and which parts of its
 * interface are shown, rather than what the chart shows. Authors never set
 * these in the chart editor; developers pass them in code, e.g. as the
 * `config` of a {@link GrapherLoader}.
 */
export interface GrapherProgrammaticInterface extends GrapherInterface {
    /** Query string to initialise the chart's state from, in the same format
     *  as a grapher page URL, e.g. `"?tab=map&time=2020"`. */
    queryStr?: string
    /** @internal */
    bounds?: Bounds
    /** @internal */
    table?: OwidTable
    /** @internal */
    baseUrl?: string
    /** Base URL that chart page links are derived from: published charts link
     *  to `<bakedGrapherURL>/<slug>`. Defaults to `"/grapher"`. */
    bakedGrapherURL?: string
    /** The URL of the chart's own page, which the title and the "Explore the
     *  data" button link to and the share menu shares. Overrides the URL
     *  derived from `bakedGrapherURL` and `slug`. `null` means the chart has
     *  no such page: the title is plain text, and the "Explore the data"
     *  button and share menu are not shown. */
    canonicalUrl?: string | null
    /** @internal */
    adminBaseUrl?: string
    /** @internal */
    env?: string
    /** Times to mark in line charts, as if the cursor were hovering them. */
    highlightedTimesInLineChart?: Time[]
    /** @internal */
    baseFontSize?: number
    /** @internal */
    staticBounds?: Bounds
    /** @internal */
    variant?: GrapherVariant
    /** @internal */
    useMinimalLabeling?: boolean

    /** Hide the title. */
    hideTitle?: boolean
    /** Hide the subtitle. */
    hideSubtitle?: boolean
    /** Hide the note in the footer. */
    hideNote?: boolean
    /** Hide the origin URL next to the license in the footer. */
    hideOriginUrl?: boolean
    /** Hide the full-screen button. */
    hideFullscreenButton?: boolean
    /** Hide the download button. */
    hideDownloadButton?: boolean
    /** Hide the share button. */
    hideShareButton?: boolean
    /** Hide the "Donate" button, which is shown when the chart is rendered
     *  inside an iframe. */
    hideDonateButton?: boolean

    /** Hide the controls for selecting entities (countries, regions, …),
     *  including selecting them on the map. */
    hideEntityControls?: boolean
    /** Hide the row of controls between the header and the chart (tabs,
     *  entity selection, settings). */
    hideControlsRow?: boolean
    /** Leave out the entity, time or "change in" annotations that are
     *  otherwise added to the title. */
    forceHideAnnotationFieldsInTitle?: AnnotationFieldsInTitle
    /** Whether to offer the table tab. Defaults to `true`. */
    hasTableTab?: boolean
    /** Whether to hide the "Explore the data" button, which links to the
     *  chart's own page. Defaults to `true`, except inside an iframe, where
     *  the button is always shown. Never shown without a `canonicalUrl`. */
    hideExploreTheDataButton?: boolean
    /** Hide the related question link below the chart. */
    hideRelatedQuestion?: boolean
    /** Allow selecting entities by clicking them on the map, even where the
     *  entity controls would otherwise disable that. */
    enableMapSelection?: boolean

    /** Enable keyboard shortcuts and the command palette. */
    enableKeyboardShortcuts?: boolean
    /** Keep the page URL's query string in sync with the chart's state. Only
     *  makes sense for a single chart that owns the page. */
    bindUrlToWindow?: boolean
    /** @internal */
    isEmbeddedInAnOwidPage?: boolean
    /** @internal */
    isEmbeddedInADataPage?: boolean
    /** @internal */
    useNewDatapageMetadataLayout?: boolean
    /** @internal */
    isConfigReady?: boolean
    /** @internal */
    isDataReady?: boolean
    /** @internal */
    canHideExternalControlsInEmbed?: boolean
    /** @internal */
    recommendedIframeEmbedHeight?: number

    /** @internal */
    narrativeChartInfo?: MinimalNarrativeChartInfo
    /** @internal */
    archiveContext?: ArchiveContext

    /** @internal */
    manager?: GrapherManager
    /** @internal */
    additionalDataLoaderFn?: AdditionalGrapherDataFetchFn
}

export type MinimalNarrativeChartInfo = Pick<
    NarrativeChartInfo,
    "name" | "parentChartSlug" | "queryParamsForParentChart"
>

interface AnalyticsContext {
    slug?: string
    viewConfigId?: string
}

export interface GrapherManager {
    baseUrl?: string
    queryStr?: string
    selection?: SelectionArray
    focusArray?: FocusArray
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

    private readonly legacyVariableDataJson:
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
        const tableWithColors = legacyToOwidTableAndDimensions(
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
        if (!this.props.grapherState.enableKeyboardShortcuts) return null
        return this.grapherState.isCommandPaletteOpen ? (
            <CommandPalette commands={this.keyboardShortcuts} />
        ) : null
    }

    @action.bound private toggleCommandPalette(): void {
        this.grapherState.isCommandPaletteOpen =
            !this.grapherState.isCommandPaletteOpen
    }

    @action.bound private toggleTabCommand(): void {
        const oldTab = this.grapherState.activeTab
        const newTab = next(this.grapherState.availableTabs, oldTab)
        this.grapherState.setTab(newTab)
        this.grapherState.onTabChange(oldTab, newTab)
    }

    @action.bound private togglePlayingCommand(): void {
        void this.grapherState.timelineController.togglePlay()
    }

    @action.bound private toggleSelectAllCommand(): void {
        if (this.grapherState.selection.hasSelection) {
            this.grapherState.selection.clearSelection()
            this.grapherState.focusArray.clear()
        } else {
            this.grapherState.selection.setSelectedEntities(
                this.grapherState.availableEntityNames
            )
        }
    }

    @action.bound private toggleFacetingCommand(): void {
        this.grapherState.hideFacetControl = !this.grapherState.hideFacetControl
    }

    @action.bound private toggleSourcesModalCommand(): void {
        const isSourcesModalOpen =
            this.grapherState.activeModal === GrapherModal.Sources
        this.grapherState.activeModal = isSourcesModalOpen
            ? undefined
            : GrapherModal.Sources
    }

    @action.bound private toggleDownloadModalCommand(): void {
        const isDownloadModalOpen =
            this.grapherState.activeModal === GrapherModal.Download
        this.grapherState.activeModal = isDownloadModalOpen
            ? undefined
            : GrapherModal.Download
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
                fn: this.toggleTabCommand,
                title: "Toggle tab",
                category: "Navigation",
            },
            {
                combo: "[Shift]+?",
                fn: this.toggleCommandPalette,
                title: `Toggle Help`,
                category: "Navigation",
            },
            {
                combo: "a",
                fn: this.toggleSelectAllCommand,
                title: this.grapherState.selection.hasSelection
                    ? `Select None`
                    : `Select All`,
                category: "Selection",
            },
            {
                combo: "f",
                fn: this.toggleFacetingCommand,
                title: `Toggle Faceting`,
                category: "Chart",
            },
            {
                combo: "p",
                fn: this.togglePlayingCommand,
                title: this.grapherState.isTimelineAnimationPlaying
                    ? `Pause`
                    : `Play`,
                category: "Timeline",
            },
            {
                combo: "l",
                fn: this.toggleYScaleTypeCommand,
                title: "Toggle Y log/linear",
                category: "Chart",
            },
            {
                combo: "w",
                fn: this.toggleFullScreenMode,
                title: `Toggle full-screen mode`,
                category: "Chart",
            },
            {
                combo: "s",
                fn: this.toggleSourcesModalCommand,
                title: `Toggle sources modal`,
                category: "Chart",
            },
            {
                combo: "d",
                fn: this.toggleDownloadModalCommand,
                title: "Toggle download modal",
                category: "Chart",
            },
            { combo: "Escape", fn: this.clearErrors },
            {
                combo: "z",
                fn: this.toggleTimelineCommand,
                title: "Latest/Earliest/All period",
                category: "Timeline",
            },
            {
                combo: "Shift+O",
                fn: this.grapherState.clearQueryParams,
                title: "Reset to original",
                category: "Navigation",
            },
            {
                combo: "g",
                fn: this.grapherState.globeController.toggleGlobe,
                title: "Toggle globe view",
                category: "Map",
            },
        ]

        if (this.grapherState.slideShow) {
            const slideShow = this.grapherState.slideShow
            shortcuts.push({
                combo: "ArrowRight",
                fn: slideShow.playNext,
                title: "Next chart",
                category: "Browse",
            })
            shortcuts.push({
                combo: "ArrowLeft",
                fn: slideShow.playPrevious,
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
                    viewConfigId:
                        this.grapherState.analyticsContext.viewConfigId,
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
                    isDimmed={this.grapherState.isModalOpen}
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
                    <EntitySelectorModal manager={this.grapherState} />
                )}

                {/* Entity selector in a slide-in drawer */}
                <SlideInDrawer
                    ariaLabel="Entity selector"
                    grapherRef={this.grapherState.base}
                    isOpen={this.grapherState.isEntitySelectorDrawerOpen}
                    onOpenChange={(isOpen) => {
                        this.grapherState.isEntitySelectorModalOrDrawerOpen =
                            isOpen
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
                    <BodyPortal>
                        <TooltipContainer
                            tooltipManager={this.grapherState}
                            anchor={GrapherTooltipAnchor.Bottom}
                        />
                    </BodyPortal>
                ) : (
                    <TooltipContainer
                        tooltipManager={this.grapherState}
                        containerBounds={this.grapherState.captionedChartBounds}
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
                            flushSync(
                                action(() => {
                                    this.hasBeenVisible = true
                                })
                            )

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

    // Binds chart properties to global window title and URL. This should only
    // ever be invoked from top-level JavaScript.
    private bindToWindow(): void {
        if (!this.grapherState.bindUrlToWindow) return

        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = (): void =>
            setWindowQueryStr(queryParamsToStr(this.grapherState.changedParams))
        const debouncedPushParams = _.debounce(pushParams, 100)

        reaction(
            () => this.grapherState.changedParams,
            () => (this.debounceMode ? debouncedPushParams() : pushParams())
        )

        autorun(() => (document.title = this.grapherState.fullTitle))
    }

    @action.bound private setUpWindowResizeEventHandler(): void {
        // Worth knowing for anything driving the page: taking a full-page screenshot in
        // Chromium resizes the viewport to 1x1 and restores it ~175ms later, so this
        // handler runs with window.innerWidth === 1 and, because the debounce below fires
        // on the leading edge, redraws the chart in its narrow layout straight away. The
        // redraw at the restored width is 400ms behind, which is long enough for the
        // screenshot to catch a narrow chart inside a full-width figure.
        // Screenshot tooling therefore has to pin the chart containers and freeze these
        // dimensions before it captures.
        const updateWindowDimensions = action((): void => {
            this.grapherState.windowInnerWidth = window.innerWidth
            this.grapherState.windowInnerHeight = window.innerHeight
            this.grapherState.screenHeight = window.screen.height
        })
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

    private freezeToleranceNoticeWhileTimelineMoves(): void {
        this.grapherState.disposers.push(
            reaction(
                () => this.grapherState.isTimelineInteractionActive,
                this.grapherState.setToleranceNoticeFrozen
            )
        )
    }

    private clearFocusMode(): void {
        // Make it easy to exit focus mode by clearing it when the selection
        // or view changes. This is disabled in the admin to avoid clearing
        // focus when authors are editing the chart
        if (!this.grapherState.isAdmin) {
            this.grapherState.disposers.push(
                reaction(
                    () => [
                        this.grapherState.facetStrategy,
                        this.grapherState.selection.selectedEntityNames,
                        this.grapherState.activeTab,
                    ],
                    () => this.grapherState.focusArray.clear(),
                    // Use structural comparison to detect changes in array
                    // contents, not just reference
                    { equals: comparer.structural }
                )
            )
        }
    }

    override componentDidMount(): void {
        exposeInstanceOnWindow(this, "grapher")

        this.setUpIntersectionObserver()
        this.setUpWindowResizeEventHandler()

        this.bindToWindow()
        this.bindKeyboardShortcuts()

        this.clearFocusMode()
        this.freezeToleranceNoticeWhileTimelineMoves()
    }

    private unbindKeyboardShortcutsFn?: () => void
    private bindKeyboardShortcuts(): void {
        if (
            !this.grapherState.enableKeyboardShortcuts ||
            this.unbindKeyboardShortcutsFn
        )
            return
        const keybindings = Object.fromEntries(
            this.keyboardShortcuts.map((shortcut) => [
                shortcut.combo,
                (event: KeyboardEvent): void => {
                    event.preventDefault()
                    event.stopPropagation()
                    shortcut.fn()
                    this.grapherState.analytics.logKeyboardShortcut(
                        shortcut.title || "",
                        shortcut.combo
                    )
                },
            ])
        )
        this.unbindKeyboardShortcutsFn = tinykeys(window, keybindings)
    }

    private unbindKeyboardShortcuts(): void {
        this.unbindKeyboardShortcutsFn?.()
        this.unbindKeyboardShortcutsFn = undefined
    }

    override componentWillUnmount(): void {
        this.unbindKeyboardShortcuts()
        this.dispose()
    }

    override componentDidCatch(error: Error): void {
        this.setError(error)
        this.grapherState.analytics.logGrapherViewError(error)
    }

    debounceMode = false
}
