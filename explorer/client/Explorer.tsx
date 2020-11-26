import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, autorun, reaction } from "mobx"
import {
    GrapherInterface,
    GrapherQueryParams,
} from "grapher/core/GrapherInterface"
import {
    ExplorerControlPanel,
    ExplorerControlBar,
} from "explorer/client/ExplorerControls"
import ReactDOM from "react-dom"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import { SerializedGridProgram } from "explorer/gridLang/SerializedGridProgram"
import { ENTITY_V2_DELIMITER } from "grapher/core/EntityUrlBuilder"
import { Grapher, GrapherProgrammaticInterface } from "grapher/core/Grapher"
import {
    debounce,
    exposeInstanceOnWindow,
    throttle,
    trimObject,
} from "grapher/utils/Util"
import {
    SlideShowController,
    SlideShowManager,
} from "grapher/slideshowController/SlideShowController"
import {
    ExplorerContainerId,
    EXPLORERS_PREVIEW_ROUTE,
    UNSAVED_EXPLORER_DRAFT,
    UNSAVED_EXPLORER_PREVIEW_PATCH,
} from "./ExplorerConstants"
import { EntityPickerManager } from "grapher/controls/entityPicker/EntityPickerConstants"
import { SelectionArray } from "grapher/selection/SelectionArray"
import { ColumnSlug, SortOrder, TableSlug } from "coreTable/CoreTableConstants"
import { isNotErrorValue } from "coreTable/ErrorValues"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { EntityPicker } from "grapher/controls/entityPicker/EntityPicker"
import classNames from "classnames"
import { ColumnTypeNames } from "coreTable/CoreColumnDef"
import { BlankOwidTable, OwidTable } from "coreTable/OwidTable"
import { GlobalEntityRegistry } from "grapher/controls/globalEntityControl/GlobalEntityRegistry"
import {
    getPatchFromQueryString,
    objectFromPatch,
    objectToPatch,
} from "./Patch"
import { setWindowQueryStr } from "utils/client/url"

interface ExplorerProps extends SerializedGridProgram {
    grapherConfigs?: GrapherInterface[]
    patch?: string
    isEmbeddedInAnOwidPage?: boolean
    isInStandalonePage?: boolean
}

interface ExplorerPatchObject extends GrapherQueryParams {
    pickerSort?: SortOrder
    pickerMetric?: ColumnSlug
}

const renderLivePreviewVersion = (props: ExplorerProps) => {
    let renderedVersion: string
    setInterval(() => {
        const versionToRender =
            localStorage.getItem(UNSAVED_EXPLORER_DRAFT + props.slug) ??
            props.program
        if (versionToRender === renderedVersion) return

        const newProps = { ...props, program: versionToRender }
        ReactDOM.render(
            <Explorer
                {...newProps}
                patch={getPatchFromQueryString(window.location.search)}
                key={Date.now()}
            />,
            document.getElementById(ExplorerContainerId)
        )
        renderedVersion = versionToRender
    }, 1000)
}

@observer
export class Explorer
    extends React.Component<ExplorerProps>
    implements SlideShowManager, EntityPickerManager {
    // caution: do a ctrl+f to find untyped usages
    static renderSingleExplorerOnExplorerPage(
        program: ExplorerProps,
        grapherConfigs: GrapherInterface[]
    ) {
        const props: ExplorerProps = {
            ...program,
            grapherConfigs,
            isEmbeddedInAnOwidPage: false,
            isInStandalonePage: true,
        }

        if (window.location.href.includes(EXPLORERS_PREVIEW_ROUTE)) {
            renderLivePreviewVersion(props)
            return
        }

        ReactDOM.render(
            <Explorer
                {...props}
                patch={getPatchFromQueryString(window.location.search)}
            />,
            document.getElementById(ExplorerContainerId)
        )
    }

    explorerProgram = ExplorerProgram.fromJson(this.props).initDecisionMatrix(
        this.props.patch
    )

    private initialPatchObject = objectFromPatch(
        this.props.patch
    ) as ExplorerPatchObject

    @observable entityPickerMetric? = this.initialPatchObject.pickerMetric
    @observable entityPickerSort? = this.initialPatchObject.pickerSort

    selection = new SelectionArray(
        this.explorerProgram.selection?.split(ENTITY_V2_DELIMITER),
        undefined,
        this.explorerProgram.entityType
    )

    @computed get grapherConfigs() {
        const arr = this.props.grapherConfigs || []
        const grapherConfigsMap: Map<number, GrapherInterface> = new Map()
        arr.forEach((config) => grapherConfigsMap.set(config.id!, config))
        return grapherConfigsMap
    }

    @observable.ref grapher?: Grapher

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    componentDidMount() {
        this.setGrapher(this.grapherRef!.current!)
        this.updateGrapher()
        // Whenever the selected row changes, update Grapher.
        autorun(() => {
            this.explorerProgram.decisionMatrix.selectedRow
            this.updateGrapher()
        })

        exposeInstanceOnWindow(this, "explorer")
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.onResize() // call resize for the first time to initialize chart

        if (this.props.isInStandalonePage) this.bindToWindow()
        else GlobalEntityRegistry.add(this)
    }

    componentWillUnmount() {
        if (this.onResizeThrottled)
            window.removeEventListener("resize", this.onResizeThrottled)
    }

    // todo: break this method up and unit test more
    @action.bound private updateGrapher() {
        const grapher = this.grapher
        if (!grapher) return // todo: can we remove this?

        const grapherConfigFromExplorer = this.explorerProgram.grapherConfig

        const {
            grapherId,
            tableSlug,
            yScaleToggle,
            yAxisMin,
        } = grapherConfigFromExplorer

        const hasGrapherId = grapherId && isNotErrorValue(grapherId)

        if (hasGrapherId && grapher.id === grapherId) return

        if (grapher.id !== undefined) {
            // only start storing after first grapher load
            this.grapherParamsChangedThisSession = {
                ...this.grapherParamsChangedThisSession,
                ...grapher.params,
            }
        }
        const queryStr =
            grapher.id !== undefined ? grapher.params : this.initialPatchObject

        if (!grapher.slideShow)
            grapher.slideShow = new SlideShowController(
                this.explorerProgram.decisionMatrix.allDecisionsAsPatches(),
                0,
                this
            )

        const grapherConfig =
            grapherId && hasGrapherId ? this.grapherConfigs.get(grapherId)! : {}

        const config: GrapherProgrammaticInterface = {
            ...grapherConfig,
            ...grapherConfigFromExplorer,
            hideEntityControls: this.showExplorerControls,
            manuallyProvideData: tableSlug ? true : false,
        }

        grapher.setAuthoredVersion(config)
        grapher.reset()

        grapher.yAxis.canChangeScaleType = yScaleToggle
        grapher.yAxis.min = yAxisMin
        grapher.updateFromObject(config)
        this.setTableBySlug(tableSlug) // Set a table immediately, even if a BlankTable
        this.fetchTableAndStoreInCache(tableSlug) // Fetch a remote table in the background, if any.
        grapher.populateFromQueryParams(queryStr)
        grapher.downloadData()
        grapher.slug = this.explorerProgram.slug
        if (!hasGrapherId) grapher.id = 0
    }

    @action.bound private setTableBySlug(tableSlug?: TableSlug) {
        const grapher = this.grapher!
        grapher.inputTable = this.getTableForSlug(tableSlug)
        grapher.appendNewEntitySelectionOptions()
    }

    // todo: add tests
    private getTableForSlug(tableSlug?: TableSlug) {
        const tableDef = this.explorerProgram.getTableDef(tableSlug)
        if (!tableDef)
            return BlankOwidTable(
                tableSlug,
                `TableDef not found for '${tableSlug}'.`
            )
        const { url } = tableDef
        if (url)
            return (
                Explorer.fetchedTableCache.get([url, tableSlug].join()) ??
                BlankOwidTable(tableSlug, `Loading from ${url}.`)
            )
        return new OwidTable(tableDef.inlineData, tableDef.columnDefinitions, {
            tableDescription: `Loaded '${tableSlug}' from inline data`,
            tableSlug: tableSlug,
        }).dropEmptyRows()
    }

    // todo: add tests
    private static fetchedTableCache = new Map<string, OwidTable>()
    @action.bound private async fetchTableAndStoreInCache(
        tableSlug?: TableSlug
    ) {
        const url = this.explorerProgram.getUrlForTableSlug(tableSlug)
        // Use the tableslug as part of the key, that way if someone wants to parse the same CSV but with different column defs, they can.
        // For example, if someone wanted to use the CountryName as the entity in one chart, but the RegionName in another. Eventually which column
        // to use as the entity/series column should be a grapher config setting, and at that point we can remove this, but for now
        // providing 2+ different column defs for 1 URL is the workaround. @breck 11/21/2020
        const cacheKey = [url, tableSlug].join()
        if (!url || Explorer.fetchedTableCache.has(cacheKey)) return

        try {
            const table = await this.explorerProgram.tryFetchTableForTableSlugIfItHasUrl(
                tableSlug
            )

            if (!table) return
            Explorer.fetchedTableCache.set(cacheKey, table)
            this.setTableBySlug(tableSlug)
        } catch (err) {
            if (this.grapher)
                this.grapher.setError(
                    err,
                    <p>
                        Failed to fetch <a href={url}>{url}</a>
                    </p>
                )
        }
    }

    @action.bound setSlide(patch: string) {
        this.explorerProgram.decisionMatrix.setValuesFromPatch(patch)
    }

    private bindToWindow() {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = () =>
            this.encodedQueryString
                ? setWindowQueryStr(this.encodedQueryString)
                : null
        const debouncedPushParams = debounce(pushParams, 100)

        reaction(
            () => this.params,
            () =>
                this.grapher?.debounceMode
                    ? debouncedPushParams()
                    : pushParams()
        )
    }

    @computed private get encodedQueryString() {
        const encodedPatch = encodeURIComponent(this.patch)
        return encodedPatch ? `?patch=` + encodedPatch : undefined
    }

    @computed private get patch() {
        return objectToPatch(this.params)
    }

    // Just for debugging
    @computed private get patchAsTsv() {
        return objectToPatch(this.params, "\n", "\t")
    }

    @computed get params(): ExplorerPatchObject {
        if (!this.grapher) return {}

        const { decisionMatrix } = this.explorerProgram

        const decisionsPatchObject: any = {
            ...decisionMatrix.currentPatch,
        }

        // Remove any unchanged default props
        const clone = this.explorerProgram.clone.decisionMatrix.currentPatch
        Object.keys(decisionsPatchObject).forEach((key) => {
            if (clone[key] === decisionsPatchObject[key])
                delete decisionsPatchObject[key]
        })

        if (window.location.href.includes(EXPLORERS_PREVIEW_ROUTE))
            localStorage.setItem(
                UNSAVED_EXPLORER_PREVIEW_PATCH + this.explorerProgram.slug,
                objectToPatch(decisionsPatchObject)
            )

        const patchObject = {
            ...this.grapherParamsChangedThisSession,
            ...this.grapher.params,
            selection: this.selection.hasSelection
                ? this.selection.selectedEntityNames.join(ENTITY_V2_DELIMITER)
                : undefined,
            pickerSort: this.entityPickerSort,
            pickerMetric: this.entityPickerMetric,
            ...decisionsPatchObject,
        }

        return trimObject(patchObject)
    }

    /**
     * The complicated code here is for situations like the below:
     *
     * 1. User lands on page and is shown line chart
     * 2. User clicks map tab.
     * 3. User clicks a radio that takes them to a chart where the default tab is map tab.
     * 4. tab=map should still be in URL, even though the default in #3 is map tab.
     * 5. So if user clicks a radio to go back to #2, it should bring them back to map tab.
     *
     * To accomplish this, we need to maintain a little state containing all the url params that have changed during this user's session.
     */
    private grapherParamsChangedThisSession: ExplorerPatchObject = {}

    private get panels() {
        return this.explorerProgram.decisionMatrix.choicesWithAvailability.map(
            (choice) => (
                <ExplorerControlPanel
                    key={choice.title}
                    explorerSlug={this.explorerProgram.slug}
                    choice={choice}
                    onChange={(value) => {
                        this.explorerProgram.decisionMatrix.setValueCommand(
                            choice.title,
                            value
                        )
                    }}
                />
            )
        )
    }

    private renderHeaderElement() {
        return (
            <div className="ExplorerHeaderBox">
                <div></div>
                <div className="ExplorerTitle">
                    {this.explorerProgram.explorerTitle}
                </div>
                <div
                    className="ExplorerSubtitle"
                    dangerouslySetInnerHTML={{
                        __html: this.explorerProgram.explorerSubtitle || "",
                    }}
                ></div>
            </div>
        )
    }

    @observable private isNarrow = isNarrow()

    @computed private get showExplorerControls() {
        if (this.explorerProgram.hideControls) return false

        return this.props.isEmbeddedInAnOwidPage ? false : true
    }

    @observable private grapherContainerRef: React.RefObject<
        HTMLDivElement
    > = React.createRef()

    @observable.ref private grapherBounds = DEFAULT_BOUNDS
    @observable.ref private grapherRef: React.RefObject<
        Grapher
    > = React.createRef()

    private renderControlBar() {
        return (
            <ExplorerControlBar
                isMobile={this.isNarrow}
                showControls={this.showMobileControlsPopup}
                closeControls={this.closeControls}
            >
                {this.panels}
            </ExplorerControlBar>
        )
    }

    private renderEntityPicker() {
        return (
            <EntityPicker
                key="entityPicker"
                manager={this}
                isDropdownMenu={this.isNarrow}
            />
        )
    }

    private onResizeThrottled?: () => void

    @action.bound private toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound private onResize() {
        this.isNarrow = isNarrow()
        this.grapherBounds = this.getGrapherBounds() || this.grapherBounds
    }

    // Todo: add better logic to maximize the size of the Grapher
    private getGrapherBounds() {
        const grapherContainer = this.grapherContainerRef.current
        return grapherContainer
            ? new Bounds(
                  0,
                  0,
                  grapherContainer.clientWidth,
                  grapherContainer.clientHeight
              )
            : undefined
    }

    @observable private showMobileControlsPopup = false
    private get mobileCustomizeButton() {
        return (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="covid-customize-chart"
            >
                <FontAwesomeIcon icon={faChartLine} /> Customize chart
            </a>
        )
    }

    @action.bound private closeControls() {
        this.showMobileControlsPopup = false
    }

    // todo: add tests for this and better tests for this class in general
    @computed private get showHeaderElement() {
        return (
            this.showExplorerControls &&
            this.explorerProgram.explorerTitle &&
            this.panels.length > 0
        )
    }

    render() {
        const { showExplorerControls, showHeaderElement } = this
        return (
            <div
                className={classNames({
                    Explorer: true,
                    "mobile-explorer": this.isNarrow,
                    HideControls: !showExplorerControls,
                    "is-embed": this.props.isEmbeddedInAnOwidPage,
                })}
            >
                {showHeaderElement && this.renderHeaderElement()}
                {showHeaderElement && this.renderControlBar()}
                {showExplorerControls && this.renderEntityPicker()}
                {showExplorerControls &&
                    this.isNarrow &&
                    this.mobileCustomizeButton}
                <div className="ExplorerFigure" ref={this.grapherContainerRef}>
                    <Grapher
                        bounds={this.grapherBounds}
                        enableKeyboardShortcuts={true}
                        isInAnExplorer={true}
                        selectionArray={this.selection}
                        ref={this.grapherRef}
                    />
                </div>
            </div>
        )
    }

    @computed get entityPickerTable() {
        return this.grapher?.table
    }

    @computed get pickerColumnSlugs() {
        if (this.explorerProgram.pickerColumnSlugs)
            return this.explorerProgram.pickerColumnSlugs
        const doNotShowThese = new Set([
            ColumnTypeNames.Year,
            ColumnTypeNames.Date,
            ColumnTypeNames.Day,
            ColumnTypeNames.EntityId,
            ColumnTypeNames.EntityCode,
        ])
        return this.grapher?.table.columnsAsArray
            .filter(
                (col) => !doNotShowThese.has(col.def.type as ColumnTypeNames)
            )
            .map((col) => col.slug)
    }

    @computed get requiredColumnSlugs() {
        return this.grapher?.newSlugs ?? []
    }
}

const isNarrow = () =>
    window.screen.width < 450 || document.documentElement.clientWidth <= 800
