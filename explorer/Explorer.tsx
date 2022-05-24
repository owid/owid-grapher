import React from "react"
import { observer } from "mobx-react"
import { action, observable, computed, reaction } from "mobx"
import {
    GrapherInterface,
    GrapherQueryParams,
} from "../grapher/core/GrapherInterface.js"
import {
    ExplorerControlPanel,
    ExplorerControlBar,
} from "../explorer/ExplorerControls.js"
import ReactDOM from "react-dom"
import { ExplorerProgram } from "../explorer/ExplorerProgram.js"
import { ColumnSlug, SerializedGridProgram } from "../clientUtils/owidTypes.js"
import {
    Grapher,
    GrapherManager,
    GrapherProgrammaticInterface,
} from "../grapher/core/Grapher.js"
import {
    debounce,
    excludeUndefined,
    exposeInstanceOnWindow,
    flatten,
    isInIFrame,
    keyMap,
    omitUndefinedValues,
    throttle,
    uniqBy,
} from "../clientUtils/Util.js"
import {
    SlideShowController,
    SlideShowManager,
} from "../grapher/slideshowController/SlideShowController.js"
import {
    ExplorerChoiceParams,
    ExplorerContainerId,
    ExplorerFullQueryParams,
    EXPLORERS_PREVIEW_ROUTE,
    EXPLORERS_ROUTE_FOLDER,
    UNSAVED_EXPLORER_DRAFT,
    UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS,
} from "./ExplorerConstants.js"
import { EntityPickerManager } from "../grapher/controls/entityPicker/EntityPickerConstants.js"
import { SelectionArray } from "../grapher/selection/SelectionArray.js"
import { SortOrder, TableSlug } from "../coreTable/CoreTableConstants.js"
import { isNotErrorValue } from "../coreTable/ErrorValues.js"
import { Bounds, DEFAULT_BOUNDS } from "../clientUtils/Bounds.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"
import { EntityPicker } from "../grapher/controls/entityPicker/EntityPicker.js"
import classNames from "classnames"
import { ColumnTypeNames, CoreColumnDef } from "../coreTable/CoreColumnDef.js"
import { BlankOwidTable, OwidTable } from "../coreTable/OwidTable.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import {
    explorerUrlMigrationsById,
    migrateExplorerUrl,
} from "./urlMigrations/ExplorerUrlMigrations.js"
import { setWindowUrl, Url } from "../clientUtils/urls/Url.js"
import { ExplorerPageUrlMigrationSpec } from "./urlMigrations/ExplorerPageUrlMigrationSpec.js"
import { setSelectedEntityNamesParam } from "../grapher/core/EntityUrlBuilder.js"
import { PromiseCache } from "../clientUtils/PromiseCache.js"
import { PromiseSwitcher } from "../clientUtils/PromiseSwitcher.js"

export interface ExplorerProps extends SerializedGridProgram {
    grapherConfigs?: GrapherInterface[]
    queryStr?: string
    isEmbeddedInAnOwidPage?: boolean
    isInStandalonePage?: boolean
    isPreview?: boolean
    canonicalUrl?: string
    selection?: SelectionArray
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
                queryStr={window.location.search}
                key={Date.now()}
                isPreview={true}
            />,
            document.getElementById(ExplorerContainerId)
        )
        renderedVersion = versionToRender
    }, 1000)
}

const isNarrow = () =>
    window.screen.width < 450 || document.documentElement.clientWidth <= 800

@observer
export class Explorer
    extends React.Component<ExplorerProps>
    implements
        SlideShowManager<ExplorerChoiceParams>,
        EntityPickerManager,
        GrapherManager
{
    // caution: do a ctrl+f to find untyped usages
    static renderSingleExplorerOnExplorerPage(
        program: ExplorerProps,
        grapherConfigs: GrapherInterface[],
        urlMigrationSpec?: ExplorerPageUrlMigrationSpec
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

        let url = Url.fromURL(window.location.href)

        // Handle redirect spec that's baked on the page.
        // e.g. the old COVID Grapher to Explorer redirects are implemented this way.
        if (urlMigrationSpec) {
            const { explorerUrlMigrationId, baseQueryStr } = urlMigrationSpec
            const migration = explorerUrlMigrationsById[explorerUrlMigrationId]
            if (migration) {
                url = migration.migrateUrl(url, baseQueryStr)
            } else {
                console.error(
                    `No explorer URL migration with id ${explorerUrlMigrationId}`
                )
            }
        }

        // Handle explorer-specific migrations.
        // This is how we migrate the old CO2 explorer to the new CO2 explorer.
        // Because they are on the same path, we can't handle it like we handle
        // the COVID explorer redirects above.
        url = migrateExplorerUrl(url)

        // Update the window URL
        setWindowUrl(url)

        ReactDOM.render(
            <Explorer {...props} queryStr={url.queryStr} />,
            document.getElementById(ExplorerContainerId)
        )
    }

    private initialQueryParams = Url.fromQueryStr(this.props.queryStr ?? "")
        .queryParams as ExplorerFullQueryParams

    explorerProgram = ExplorerProgram.fromJson(this.props).initDecisionMatrix(
        this.initialQueryParams
    )

    // only used for the checkbox at the bottom of the embed dialog
    @observable embedDialogHideControls = true

    selection =
        this.props.selection ??
        new SelectionArray(
            this.explorerProgram.selection,
            undefined,
            this.explorerProgram.entityType
        )

    @observable.ref grapher?: Grapher

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    @computed get grapherConfigs() {
        const arr = this.props.grapherConfigs || []
        const grapherConfigsMap: Map<number, GrapherInterface> = new Map()
        arr.forEach((config) => grapherConfigsMap.set(config.id!, config))
        return grapherConfigsMap
    }

    disposers: (() => void)[] = []
    componentDidMount() {
        this.setGrapher(this.grapherRef!.current!)
        this.updateGrapherFromExplorer()

        let url = Url.fromQueryParams(this.initialQueryParams)

        if (this.props.selection?.hasSelection) {
            url = setSelectedEntityNamesParam(
                url,
                this.props.selection.selectedEntityNames
            )
        }

        this.grapher?.populateFromQueryParams(url.queryParams)

        exposeInstanceOnWindow(this, "explorer")
        this.onResize() // call resize for the first time to initialize chart
        this.updateEntityPickerTable() // call for the first time to initialize EntityPicker

        this.attachEventListeners()
    }

    private attachEventListeners() {
        this.onResizeThrottled = throttle(this.onResize, 100)
        window.addEventListener("resize", this.onResizeThrottled)
        this.disposers.push(() => {
            if (this.onResizeThrottled !== undefined)
                window.removeEventListener("resize", this.onResizeThrottled)
        })

        // We always prefer the entity picker metric to be sourced from the currently displayed table.
        // To do this properly, we need to also react to the table changing.
        this.disposers.push(
            reaction(
                () => [
                    this.entityPickerMetric,
                    this.explorerProgram.grapherConfig.tableSlug,
                ],
                () => this.updateEntityPickerTable()
            )
        )

        if (this.props.isInStandalonePage) this.bindToWindow()
    }

    componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }

    private initSlideshow() {
        const grapher = this.grapher
        if (!grapher || grapher.slideShow) return

        grapher.slideShow = new SlideShowController(
            this.explorerProgram.decisionMatrix.allDecisionsAsQueryParams(),
            0,
            this
        )
    }

    private persistedGrapherQueryParamsBySelectedRow: Map<
        number,
        Partial<GrapherQueryParams>
    > = new Map()

    // todo: break this method up and unit test more. this is pretty ugly right now.
    @action.bound private reactToUserChangingSelection(oldSelectedRow: number) {
        if (!this.grapher || !this.explorerProgram.currentlySelectedGrapherRow)
            return // todo: can we remove this?
        this.initSlideshow()

        const oldGrapherParams = this.grapher.changedParams
        this.persistedGrapherQueryParamsBySelectedRow.set(
            oldSelectedRow,
            oldGrapherParams
        )

        const newGrapherParams = {
            ...this.persistedGrapherQueryParamsBySelectedRow.get(
                this.explorerProgram.currentlySelectedGrapherRow
            ),
            region: oldGrapherParams.region,
            time: this.grapher.timeParam,
        }

        const previousTab = this.grapher.tab

        this.updateGrapherFromExplorer()

        // preserve the previous tab if that's still available in the new view;
        // and use the first tab otherwise
        newGrapherParams.tab = this.grapher.availableTabs.includes(previousTab)
            ? previousTab
            : this.grapher.availableTabs[0]

        this.grapher.populateFromQueryParams(newGrapherParams)
    }

    @action.bound private setGrapherTable(table: OwidTable) {
        if (this.grapher) {
            this.grapher.inputTable = table
            this.grapher.appendNewEntitySelectionOptions()
        }
    }

    private futureGrapherTable = new PromiseSwitcher<OwidTable>({
        onResolve: (table) => this.setGrapherTable(table),
        onReject: (error) => this.grapher?.setError(error),
    })

    tableLoader = new PromiseCache((slug: TableSlug | undefined) =>
        this.explorerProgram.constructTable(slug)
    )

    @action.bound updateGrapherFromExplorer() {
        const grapher = this.grapher
        if (!grapher) return
        const grapherConfigFromExplorer = this.explorerProgram.grapherConfig
        const {
            grapherId,
            tableSlug,
            yScaleToggle,
            yAxisMin,
            facetYDomain,
            relatedQuestionText,
            relatedQuestionUrl,
        } = grapherConfigFromExplorer

        const hasGrapherId = grapherId && isNotErrorValue(grapherId)

        const grapherConfig = hasGrapherId
            ? this.grapherConfigs.get(grapherId!) ?? {}
            : {}

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
        if (facetYDomain) {
            grapher.yAxis.facetDomain = facetYDomain
        }
        if (relatedQuestionText && relatedQuestionUrl) {
            grapher.relatedQuestions = [
                { text: relatedQuestionText, url: relatedQuestionUrl },
            ]
        }
        grapher.updateFromObject(config)

        if (!hasGrapherId) {
            // Clear any error messages, they are likely to be related to dataset loading.
            this.grapher?.clearErrors()
            // Set a table immediately. A BlankTable shows a loading animation.
            this.setGrapherTable(
                BlankOwidTable(tableSlug, `Loading table '${tableSlug}'`)
            )
            this.futureGrapherTable.set(this.tableLoader.get(tableSlug))
            grapher.id = 0
        }

        // Download data if this is a Grapher ID inside the Explorer specification
        grapher.downloadData()
        grapher.slug = this.explorerProgram.slug

        if (this.downloadDataLink)
            grapher.externalCsvLink = this.downloadDataLink
    }

    @action.bound setSlide(choiceParams: ExplorerFullQueryParams) {
        this.explorerProgram.decisionMatrix.setValuesFromChoiceParams(
            choiceParams
        )
    }

    @computed private get currentChoiceParams(): ExplorerChoiceParams {
        const { decisionMatrix } = this.explorerProgram
        return decisionMatrix.currentParams
    }

    @computed get queryParams(): ExplorerFullQueryParams {
        if (!this.grapher) return {}

        if (window.location.href.includes(EXPLORERS_PREVIEW_ROUTE))
            localStorage.setItem(
                UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS +
                    this.explorerProgram.slug,
                JSON.stringify(this.currentChoiceParams)
            )

        let url = Url.fromQueryParams(
            omitUndefinedValues({
                ...this.grapher.changedParams,
                pickerSort: this.entityPickerSort,
                pickerMetric: this.entityPickerMetric,
                hideControls: this.initialQueryParams.hideControls || undefined,
                ...this.currentChoiceParams,
            })
        )

        url = setSelectedEntityNamesParam(
            url,
            this.selection.hasSelection
                ? this.selection.selectedEntityNames
                : undefined
        )

        return url.queryParams as ExplorerFullQueryParams
    }

    @computed get currentUrl(): Url {
        if (this.props.isPreview) return Url.fromQueryParams(this.queryParams)
        return Url.fromURL(this.baseUrl).setQueryParams(this.queryParams)
    }

    private bindToWindow() {
        // There is a surprisingly considerable performance overhead to updating the url
        // while animating, so we debounce to allow e.g. smoother timelines
        const pushParams = () => setWindowUrl(this.currentUrl)
        const debouncedPushParams = debounce(pushParams, 100)

        this.disposers.push(
            reaction(
                () => this.queryParams,
                () =>
                    this.grapher?.debounceMode
                        ? debouncedPushParams()
                        : pushParams()
            )
        )
    }

    private get panels() {
        return this.explorerProgram.decisionMatrix.choicesWithAvailability.map(
            (choice) => (
                <ExplorerControlPanel
                    key={choice.title}
                    explorerSlug={this.explorerProgram.slug}
                    choice={choice}
                    onChange={this.onChangeChoice(choice.title)}
                    isMobile={this.isNarrow}
                />
            )
        )
    }

    onChangeChoice = (choiceTitle: string) => (value: string) => {
        const { currentlySelectedGrapherRow } = this.explorerProgram
        this.explorerProgram.decisionMatrix.setValueCommand(choiceTitle, value)
        if (currentlySelectedGrapherRow)
            this.reactToUserChangingSelection(currentlySelectedGrapherRow)
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

    @computed private get isInIFrame() {
        return isInIFrame()
    }

    @computed private get showExplorerControls() {
        if (!this.props.isEmbeddedInAnOwidPage && !this.isInIFrame) return true
        // Only allow hiding controls on embedded pages
        return !(
            this.explorerProgram.hideControls ||
            this.initialQueryParams.hideControls === "true"
        )
    }

    @computed private get downloadDataLink(): string | undefined {
        return this.explorerProgram.downloadDataLink
    }

    @observable
    private grapherContainerRef: React.RefObject<HTMLDivElement> =
        React.createRef()

    @observable.ref private grapherBounds = DEFAULT_BOUNDS
    @observable.ref
    private grapherRef: React.RefObject<Grapher> = React.createRef()

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
        const oldIsNarrow = this.isNarrow
        this.isNarrow = isNarrow()
        this.updateGrapherBounds()

        // If we changed between narrow and wide mode, we need to wait for CSS changes to kick in
        // to properly calculate the new grapher bounds
        if (this.isNarrow !== oldIsNarrow)
            window.setTimeout(() => this.updateGrapherBounds(), 0)
    }

    // Todo: add better logic to maximize the size of the Grapher
    private updateGrapherBounds() {
        const grapherContainer = this.grapherContainerRef.current
        if (grapherContainer)
            this.grapherBounds = new Bounds(
                0,
                0,
                grapherContainer.clientWidth,
                grapherContainer.clientHeight
            )
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
                        manager={this}
                        ref={this.grapherRef}
                    />
                </div>
            </div>
        )
    }

    @computed get editUrl() {
        return `${EXPLORERS_ROUTE_FOLDER}/${this.props.slug}`
    }

    @computed get baseUrl() {
        return `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${this.props.slug}`
    }

    @computed get canonicalUrl() {
        return this.props.canonicalUrl ?? this.currentUrl.fullUrl
    }

    @computed get embedDialogUrl() {
        return this.currentUrl.updateQueryParams({
            hideControls: this.embedDialogHideControls.toString(),
        }).fullUrl
    }

    @action.bound embedDialogToggleHideControls() {
        this.embedDialogHideControls = !this.embedDialogHideControls
    }

    @computed get embedDialogAdditionalElements() {
        return (
            <div style={{ marginTop: ".5rem" }}>
                <label>
                    <input
                        type="checkbox"
                        checked={this.embedDialogHideControls}
                        onChange={this.embedDialogToggleHideControls}
                    />{" "}
                    Hide controls
                </label>
            </div>
        )
    }

    @computed get grapherTable() {
        return this.grapher?.tableAfterAuthorTimelineFilter
    }

    @observable entityPickerMetric? = this.initialQueryParams.pickerMetric
    @observable entityPickerSort? = this.initialQueryParams.pickerSort

    @observable.ref entityPickerTable?: OwidTable
    @observable.ref entityPickerTableIsLoading: boolean = false

    private futureEntityPickerTable = new PromiseSwitcher<OwidTable>({
        onResolve: (table) => {
            this.entityPickerTable = table
            this.entityPickerTableIsLoading = false
        },
        onReject: () => {
            this.entityPickerTableIsLoading = false
        },
    })

    private updateEntityPickerTable(): void {
        if (this.entityPickerMetric) {
            this.entityPickerTableIsLoading = true
            this.futureEntityPickerTable.set(
                this.tableLoader.get(
                    this.getTableSlugOfColumnSlug(this.entityPickerMetric)
                )
            )
        }
    }

    setEntityPicker({
        metric,
        sort,
    }: { metric?: string; sort?: SortOrder } = {}) {
        if (metric) this.entityPickerMetric = metric
        if (sort) this.entityPickerSort = sort
    }

    private tableSlugHasColumnSlug(
        tableSlug: TableSlug | undefined,
        columnSlug: ColumnSlug
    ) {
        const columnDefsByTableSlug = this.explorerProgram.columnDefsByTableSlug
        return !!columnDefsByTableSlug
            .get(tableSlug)
            ?.find((def) => def.slug === columnSlug)
    }

    private getTableSlugOfColumnSlug(
        columnSlug: ColumnSlug
    ): TableSlug | undefined {
        // In most cases, column slugs will be duplicated in the tables, e.g. entityName.
        // Prefer the current Grapher table if it contains the column slug.
        const grapherTableSlug = this.explorerProgram.grapherConfig.tableSlug
        if (this.tableSlugHasColumnSlug(grapherTableSlug, columnSlug)) {
            return grapherTableSlug
        }
        // ...otherwise, search all tables for the column slug
        return this.explorerProgram.tableSlugs.find((tableSlug) =>
            this.tableSlugHasColumnSlug(tableSlug, columnSlug)
        )
    }

    @computed get entityPickerColumnDefs(): CoreColumnDef[] {
        const allColumnDefs = uniqBy(
            flatten(
                Array.from(this.explorerProgram.columnDefsByTableSlug.values())
            ),
            (def) => def.slug
        )

        if (this.explorerProgram.pickerColumnSlugs) {
            const columnDefsBySlug = keyMap(allColumnDefs, (def) => def.slug)
            // Preserve the order of columns in the Explorer `pickerColumnSlugs`
            return excludeUndefined(
                this.explorerProgram.pickerColumnSlugs.map((slug) =>
                    columnDefsBySlug.get(slug)
                )
            )
        } else {
            const discardColumnTypes = new Set([
                ColumnTypeNames.Year,
                ColumnTypeNames.Date,
                ColumnTypeNames.Day,
                ColumnTypeNames.EntityId,
                ColumnTypeNames.EntityCode,
            ])
            return allColumnDefs.filter(
                (def) =>
                    def.type === undefined || !discardColumnTypes.has(def.type)
            )
        }
    }

    @computed get requiredColumnSlugs() {
        return this.grapher?.newSlugs ?? []
    }
}
