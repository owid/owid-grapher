import * as _ from "lodash-es"
import { faChartLine } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    ColumnTypeNames,
    CoreColumnDef,
    OwidColumnDef,
    SortOrder,
    TableSlug,
    GrapherInterface,
    GrapherQueryParams,
    EntityName,
    GRAPHER_TAB_QUERY_PARAMS,
} from "@ourworldindata/types"
import {
    OwidTable,
    BlankOwidTable,
    extractPotentialDataSlugsFromTransform,
} from "@ourworldindata/core-table"
import {
    EntityPicker,
    EntityPickerManager,
    Grapher,
    GrapherManager,
    GrapherProgrammaticInterface,
    SelectionArray,
    setSelectedEntityNamesParam,
    SlideShowController,
    SlideShowManager,
    DEFAULT_GRAPHER_ENTITY_TYPE,
    GrapherAnalytics,
    GrapherState,
    fetchInputTableForConfig,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import {
    Bounds,
    ColumnSlug,
    DimensionProperty,
    excludeUndefined,
    exposeInstanceOnWindow,
    isInIFrame,
    keyMap,
    mergeGrapherConfigs,
    omitUndefinedValues,
    parseIntOrUndefined,
    PromiseCache,
    PromiseSwitcher,
    SerializedGridProgram,
    setWindowUrl,
    Tippy,
    Url,
} from "@ourworldindata/utils"
import { MarkdownTextWrap } from "@ourworldindata/components"
import classNames from "classnames"
import { action, computed, makeObservable, observable, reaction } from "mobx"
import { observer } from "mobx-react"
import React, { useCallback, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import { ExplorerControlBar, ExplorerControlPanel } from "./ExplorerControls.js"
import { ExplorerProgram } from "./ExplorerProgram.js"
import {
    ExplorerChartCreationMode,
    ExplorerChoiceParams,
    ExplorerContainerId,
    ExplorerFullQueryParams,
    EXPLORERS_PREVIEW_ROUTE,
    EXPLORERS_ROUTE_FOLDER,
    UNSAVED_EXPLORER_DRAFT,
    UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS,
} from "./ExplorerConstants.js"
import { ExplorerPageUrlMigrationSpec } from "./urlMigrations/ExplorerPageUrlMigrationSpec.js"
import {
    explorerUrlMigrationsById,
    migrateExplorerUrl,
} from "./urlMigrations/ExplorerUrlMigrations.js"

export interface ExplorerProps extends SerializedGridProgram {
    grapherConfigs?: GrapherInterface[]
    partialGrapherConfigs?: GrapherInterface[]
    queryStr?: string
    isEmbeddedInAnOwidPage?: boolean
    isInStandalonePage?: boolean
    isPreview?: boolean
    canonicalUrl?: string
    selection?: SelectionArray
    adminBaseUrl: string
    bakedBaseUrl: string
    bakedGrapherUrl: string
    dataApiUrl: string
    bounds?: Bounds
    staticBounds?: Bounds
    loadMetadataOnly?: boolean
    throwOnMissingGrapher?: boolean
    setupGrapher?: boolean
}

const LivePreviewComponent = (props: ExplorerProps) => {
    const [useLocalStorage, setUseLocalStorage] = useState(true)
    const [renderedProgram, setRenderedProgram] = useState("")
    const [hasLocalStorage, setHasLocalStorage] = useState(false)

    const updateProgram = useCallback(() => {
        const localStorageProgram = localStorage.getItem(
            UNSAVED_EXPLORER_DRAFT + props.slug
        )
        let program: string
        if (useLocalStorage) program = localStorageProgram ?? props.program
        else program = props.program

        setHasLocalStorage(!!localStorageProgram)
        setRenderedProgram((previousProgram) => {
            if (program === previousProgram) return previousProgram
            return program
        })
    }, [props.program, props.slug, useLocalStorage])

    useEffect(() => {
        updateProgram()
        const interval = setInterval(updateProgram, 1000)
        return () => clearInterval(interval)
    }, [updateProgram])

    const newProps = { ...props, program: renderedProgram }

    return (
        <>
            {hasLocalStorage && (
                <div className="admin-only-locally-edited-checkbox">
                    <Tippy
                        content={
                            <span>
                                <p>
                                    <b>Checked</b>: Use the explorer version
                                    with changes as present in the admin.
                                </p>
                                <p>
                                    <b>Unchecked</b>: Use the currently-saved
                                    version.
                                </p>
                                <hr />
                                <p>
                                    Note that some features may only work
                                    correctly when this checkbox is unchecked:
                                    in particular, using <kbd>catalogPath</kbd>s
                                    and <kbd>grapherId</kbd>s and variable IDs.
                                </p>
                            </span>
                        }
                        placement="bottom"
                    >
                        <label>
                            <input
                                type="checkbox"
                                id="useLocalStorage"
                                onChange={(e) =>
                                    setUseLocalStorage(e.target.checked)
                                }
                                checked={useLocalStorage}
                            />
                            Display locally edited explorer
                        </label>
                    </Tippy>
                </div>
            )}
            <Explorer
                {...newProps}
                queryStr={window?.location?.search ?? ""}
                key={Date.now()}
                isPreview={true}
            />
        </>
    )
}

const renderLivePreviewVersion = (props: ExplorerProps) => {
    const elem = document.getElementById(ExplorerContainerId)
    if (!elem) throw new Error("ExplorerContainerId not found in DOM")
    const root = createRoot(elem)
    root.render(<LivePreviewComponent {...props} />)
}

const isNarrow = () =>
    typeof window === "undefined"
        ? false
        : window.screen.width < 450 ||
          document.documentElement.clientWidth <= 800

@observer
export class Explorer
    extends React.Component<ExplorerProps>
    implements
        SlideShowManager<ExplorerChoiceParams>,
        EntityPickerManager,
        GrapherManager
{
    analytics = new GrapherAnalytics()
    grapherState: GrapherState
    inputTableTransformer = (table: OwidTable) => table

    constructor(props: ExplorerProps) {
        super(props)

        makeObservable<
            Explorer,
            | "isNarrow"
            | "grapherContainerRef"
            | "grapherRef"
            | "showMobileControlsPopup"
        >(this, {
            appendOnlyAvailableEntityNames: observable,
            grapher: observable.ref,
            isNarrow: observable,
            grapherContainerRef: observable,
            grapherRef: observable.ref,
            showMobileControlsPopup: observable,
            entityPickerMetric: observable,
            entityPickerSort: observable,
            entityPickerTable: observable.ref,
            entityPickerTableIsLoading: observable.ref,
        })

        this.explorerProgram = ExplorerProgram.fromJson(
            props
        ).initDecisionMatrix(this.initialQueryParams)
        this.grapherState = new GrapherState({
            staticBounds: props.staticBounds,
            bounds: props.bounds,
            enableKeyboardShortcuts: this.props.isInStandalonePage,
            manager: this,
            isEmbeddedInAnOwidPage: this.props.isEmbeddedInAnOwidPage,
            adminBaseUrl: this.adminBaseUrl,
            canHideExternalControlsInEmbed: true,
            additionalDataLoaderFn: (
                varId: number,
                loadMetadataOnly?: boolean
            ) =>
                loadVariableDataAndMetadata(varId, this.dataApiUrl, {
                    noCache: props.isPreview,
                    loadMetadataOnly,
                }),
        })

        if (props.setupGrapher !== false)
            this.grapher = new Grapher({ grapherState: this.grapherState })
    }
    // caution: do a ctrl+f to find untyped usages
    static renderSingleExplorerOnExplorerPage(
        program: ExplorerProps,
        grapherConfigs: GrapherInterface[],
        partialGrapherConfigs: GrapherInterface[],
        explorerConstants: Record<string, string>,
        urlMigrationSpec?: ExplorerPageUrlMigrationSpec
    ) {
        const props: ExplorerProps = {
            ...program,
            ...explorerConstants,
            grapherConfigs,
            partialGrapherConfigs,
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

        const elem = document.getElementById(ExplorerContainerId)
        if (!elem) throw new Error("ExplorerContainerId not found in DOM")

        const root = createRoot(elem)
        root.render(<Explorer {...props} queryStr={url.queryStr} />)
    }

    private initialQueryParams = Url.fromQueryStr(this.props.queryStr ?? "")
        .queryParams as ExplorerFullQueryParams

    explorerProgram = ExplorerProgram.fromJson(this.props).initDecisionMatrix(
        this.initialQueryParams
    )

    bakedBaseUrl = this.props.bakedBaseUrl
    dataApiUrl = this.props.dataApiUrl
    adminBaseUrl = this.props.adminBaseUrl
    bakedGrapherUrl = this.props.bakedGrapherUrl

    selection = this.props.selection?.hasSelection
        ? this.props.selection
        : new SelectionArray(this.explorerProgram.selection)

    entityType = this.explorerProgram.entityType ?? DEFAULT_GRAPHER_ENTITY_TYPE

    // We want to ensure that unavailable entity are shown in the explorer entity
    // that's why we employ an append-only version of `grapher.availableEntityNames`
    appendOnlyAvailableEntityNames: Set<EntityName> = new Set()

    grapher: Grapher | undefined = undefined

    @action.bound setGrapher(grapher: Grapher) {
        this.grapher = grapher
    }

    @computed get grapherConfigs() {
        const arr = this.props.grapherConfigs || []
        return new Map(arr.map((config) => [config.id!, config]))
    }

    @computed get partialGrapherConfigsByVariableId() {
        const arr = this.props.partialGrapherConfigs || []
        return new Map(arr.map((config) => [config.id!, config]))
    }

    @computed get partialGrapherConfigsBySlug() {
        const configsBySlug = new Map<string, GrapherInterface>()
        for (const columnDef of this.explorerProgram
            .columnDefsWithoutTableSlug) {
            if (columnDef.transform?.startsWith("duplicate")) {
                const indicatorId = +columnDef.transform
                    .replace("duplicate", "")
                    .trim()
                const partialGrapherConfig =
                    this.partialGrapherConfigsByVariableId.get(indicatorId)
                if (partialGrapherConfig)
                    configsBySlug.set(columnDef.slug, partialGrapherConfig)
            }
        }
        return configsBySlug
    }

    private setUpIntersectionObserver(): void {
        if (typeof window !== "undefined" && "IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        this.analytics.logExplorerView(
                            this.explorerProgram.slug,
                            this.explorerProgram.decisionMatrix.currentParams
                        )
                        observer.disconnect()
                    }
                })
            })
            observer.observe(this.grapherContainerRef.current!)
            this.disposers.push(() => observer.disconnect())
        }
    }

    disposers: (() => void)[] = []
    override async componentDidMount() {
        this.setGrapher(this.grapherRef!.current!)

        let url = Url.fromQueryParams(this.initialQueryParams)

        if (this.props.selection?.hasSelection) {
            url = setSelectedEntityNamesParam(
                url,
                this.props.selection.selectedEntityNames
            )
        }
        // Run the initializiation for the grapherState but don't await it. The update code
        // will reset and initialize the grapherState and then the data loading will be awaited inside the function.
        // We don't want to wait for the data loading to finish as we only care about the non-data loading
        // part to run (the data loading can finish whenever)
        void this.updateGrapherFromExplorer()

        // Do the rest of the initialization
        this.grapherState.populateFromQueryParams(url.queryParams)
        exposeInstanceOnWindow(this, "explorer")
        this.setUpIntersectionObserver()
        this.attachEventListeners()
        this.updateEntityPickerTable() // call for the first time to initialize EntityPicker
    }

    private attachEventListeners() {
        if (typeof window !== "undefined" && "ResizeObserver" in window) {
            const onResizeThrottled = _.debounce(this.onResize, 200, {
                leading: true,
            })
            const resizeObserver = new ResizeObserver(onResizeThrottled)
            resizeObserver.observe(this.grapherContainerRef.current!)
            this.disposers.push(() => {
                resizeObserver.disconnect()
            })
        } else if (
            typeof window === "object" &&
            typeof document === "object" &&
            !navigator.userAgent.includes("jsdom")
        ) {
            // only show the warning when we're in something that roughly resembles a browser
            console.warn(
                "ResizeObserver not available; the explorer will not be responsive to window resizes"
            )

            this.onResize() // fire once to initialize, at least
        }

        // We always prefer the entity picker metric to be sourced from the currently displayed table.
        // To do this properly, we need to also react to the table changing.
        this.disposers.push(
            reaction(
                () => [
                    this.entityPickerMetric,
                    this.explorerProgram.explorerGrapherConfig.tableSlug,
                ],
                () => this.updateEntityPickerTable()
            )
        )

        this.disposers.push(
            reaction(
                () => this.grapherState.availableEntityNames,
                (availableEntityNames) => {
                    availableEntityNames?.forEach((entity) =>
                        this.appendOnlyAvailableEntityNames.add(entity)
                    )
                }
            )
        )

        if (this.props.isInStandalonePage) this.bindToWindow()
    }

    override componentWillUnmount() {
        this.disposers.forEach((dispose) => dispose())
    }

    private initSlideshow() {
        if (this.grapherState.slideShow) return

        this.grapherState.slideShow = new SlideShowController(
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
    @action.bound private async reactToUserChangingSelection(
        oldSelectedRow: number
    ) {
        if (!this.explorerProgram.currentlySelectedGrapherRow) return
        this.initSlideshow()

        const oldGrapherParams = this.grapherState.changedParams
        this.persistedGrapherQueryParamsBySelectedRow.set(
            oldSelectedRow,
            oldGrapherParams
        )

        const newGrapherParams = {
            ...this.persistedGrapherQueryParamsBySelectedRow.get(
                this.explorerProgram.currentlySelectedGrapherRow
            ),
            country: oldGrapherParams.country,
            region: oldGrapherParams.region,
            time: this.grapherState.timeParam,
        }

        const previousTab = this.grapherState.activeTab

        await this.updateGrapherFromExplorer()

        newGrapherParams.tab =
            this.grapherState.mapGrapherTabToQueryParam(previousTab)

        // reset map state if switching to a chart
        if (newGrapherParams.tab !== GRAPHER_TAB_QUERY_PARAMS.map) {
            newGrapherParams.globe = "0"
            newGrapherParams.mapSelect = ""
        }

        this.grapherState.populateFromQueryParams(newGrapherParams)

        // When switching between explorer views, we usually preserve the tab.
        // However, if the new chart doesn't support the previously selected tab,
        // Grapher automatically switches to a supported one. In such cases,
        // we call onChartSwitching to make adjustments that ensure the new view
        // is sensible (e.g. updating the time selection when switching from a
        // single-time chart like a discrete bar chart to a multi-time chart like
        // a line chart).
        const currentTab = this.grapherState.activeTab
        if (previousTab !== currentTab)
            this.grapherState.onChartSwitching(previousTab, currentTab)

        this.analytics.logExplorerView(
            this.explorerProgram.slug,
            this.explorerProgram.decisionMatrix.currentParams
        )
    }

    @action.bound private setGrapherTable(table: OwidTable) {
        if (this.grapherState) {
            this.grapherState.inputTable = this.inputTableTransformer(table)
        }
    }

    @computed get availableEntityNames(): EntityName[] {
        const entityNameSet = this.appendOnlyAvailableEntityNames
        return Array.from(entityNameSet)
    }

    @computed private get enableMapSelection(): boolean {
        return !this.isNarrow
    }

    private futureGrapherTable = new PromiseSwitcher<OwidTable>({
        onResolve: (table) => this.setGrapherTable(table),
        onReject: (error) => this.grapher?.setError(error),
    })

    tableLoader = new PromiseCache((slug: TableSlug | undefined) =>
        this.explorerProgram.constructTable(slug)
    )

    @action.bound async updateGrapherFromExplorer() {
        switch (this.explorerProgram.chartCreationMode) {
            case ExplorerChartCreationMode.FromGrapherId:
                return this.updateGrapherFromExplorerUsingGrapherId()
            case ExplorerChartCreationMode.FromVariableIds:
                return this.updateGrapherFromExplorerUsingVariableIds()
            case ExplorerChartCreationMode.FromExplorerTableColumnSlugs:
                return this.updateGrapherFromExplorerUsingColumnSlugs()
        }
    }

    @computed private get columnDefsWithoutTableSlugByIdOrSlug(): Record<
        number | string,
        OwidColumnDef
    > {
        const { columnDefsWithoutTableSlug } = this.explorerProgram
        return _.keyBy(
            columnDefsWithoutTableSlug,
            (def: OwidColumnDef) => def.owidVariableId ?? def.slug
        )
    }

    // gets the slugs of all base and intermediate columns that a
    // transformed column depends on; for example, if a column's transform
    // is 'divideBy 170775 other_slug' and 'other_slug' is also a transformed
    // column defined by 'multiplyBy 539022 2', then this function
    // returns ['539022', '170775', 'other_slug']
    private getBaseColumnsForColumnWithTransform(slug: string): string[] {
        const def = this.columnDefsWithoutTableSlugByIdOrSlug[slug]
        if (!def?.transform) return []
        const dataSlugs =
            extractPotentialDataSlugsFromTransform(def.transform) ?? []
        return dataSlugs.flatMap((dataSlug) => [
            ...this.getBaseColumnsForColumnWithTransform(dataSlug),
            dataSlug,
        ])
    }

    // gets the IDs of all variables that a transformed column depends on;
    // for example, if a there are two columns, 'slug' and 'other_slug', that
    // are defined by the transforms 'divideBy 170775 other_slug' and 'multiplyBy 539022 2',
    // respectively, then getBaseVariableIdsForColumnWithTransform('slug')
    // returns ['539022', '170775'] as these are the IDs of the two variables
    // that the 'slug' column depends on
    private getBaseVariableIdsForColumnWithTransform(slug: string): string[] {
        const { columnDefsWithoutTableSlug } = this.explorerProgram
        const baseVariableIdsAndColumnSlugs =
            this.getBaseColumnsForColumnWithTransform(slug)
        const slugsInColumnBlock: string[] = columnDefsWithoutTableSlug
            .filter((def) => !def.owidVariableId)
            .map((def) => def.slug)
        return baseVariableIdsAndColumnSlugs.filter(
            (variableIdOrColumnSlug) =>
                !slugsInColumnBlock.includes(variableIdOrColumnSlug)
        )
    }

    @action.bound async updateGrapherFromExplorerUsingGrapherId() {
        const grapherState = this.grapherState

        const { grapherId } = this.explorerProgram.explorerGrapherConfig
        const grapherConfig = this.grapherConfigs.get(grapherId!)
        if (!grapherConfig) {
            if (this.props.throwOnMissingGrapher) {
                throw new Error(`Grapher config not found for ID: ${grapherId}`)
            }
        }
        const finalGrapherConfig = grapherConfig ?? {}

        const config: GrapherProgrammaticInterface = {
            ...mergeGrapherConfigs(
                finalGrapherConfig,
                this.explorerProgram.grapherConfig
            ),
            bakedGrapherURL: this.bakedBaseUrl,
            adminBaseUrl: this.adminBaseUrl,
            hideEntityControls: this.showExplorerControls,
            enableMapSelection: this.enableMapSelection,
        }

        // if not empty, respect the explorer's selection
        if (this.selection.hasSelection) {
            config.selectedEntityNames = this.selection.selectedEntityNames
        }

        grapherState.setAuthoredVersion(config)
        grapherState.reset()
        grapherState.inputTable = BlankOwidTable()
        grapherState.updateFromObject(config)
        if (!config.table) {
            const inputTable = await fetchInputTableForConfig(
                config.dimensions ?? [],
                config.selectedEntityColors,
                this.props.dataApiUrl,
                undefined,
                this.props.isPreview,
                this.props.loadMetadataOnly
            )
            if (inputTable)
                grapherState.inputTable = this.inputTableTransformer(inputTable)
        } else {
            grapherState.inputTable = this.inputTableTransformer(config.table)
        }
    }

    @action.bound async updateGrapherFromExplorerUsingVariableIds() {
        const grapherState = this.grapherState
        const {
            yVariableIds = "",
            xVariableId,
            colorVariableId,
            sizeVariableId,
            ySlugs = "",
            xSlug,
            colorSlug,
            sizeSlug,
        } = this.explorerProgram.explorerGrapherConfig

        const yVariableIdsList = yVariableIds
            .split(" ")
            .map(parseIntOrUndefined)
            .filter((item) => item !== undefined)
        const ySlugList = ySlugs.split(" ")

        const partialGrapherConfig =
            this.partialGrapherConfigsByVariableId.get(yVariableIdsList[0]) ??
            // if ySlug references a column that duplicates an indicator via the
            // `duplicate` transform, make sure the partial grapher config for
            // that indicator is pulled in
            this.partialGrapherConfigsBySlug.get(ySlugList[0]) ??
            {}

        const config: GrapherProgrammaticInterface = {
            ...mergeGrapherConfigs(
                partialGrapherConfig,
                this.explorerProgram.grapherConfig
            ),
            bakedGrapherURL: this.bakedBaseUrl,
            adminBaseUrl: this.adminBaseUrl,
            hideEntityControls: this.showExplorerControls,
            enableMapSelection: this.enableMapSelection,
        }

        // if not empty, respect the explorer's selection
        if (this.selection.hasSelection) {
            config.selectedEntityNames = this.selection.selectedEntityNames
        }

        // set given variable IDs as dimensions to make Grapher
        // download the data and metadata for these variables
        const dimensions = config.dimensions?.slice() ?? []
        yVariableIdsList.forEach((yVariableId) => {
            dimensions.push({
                variableId: yVariableId,
                property: DimensionProperty.y,
            })
        })

        if (xVariableId) {
            const maybeXVariableId = parseIntOrUndefined(xVariableId)
            if (maybeXVariableId !== undefined)
                dimensions.push({
                    variableId: maybeXVariableId,
                    property: DimensionProperty.x,
                })
        }
        if (colorVariableId) {
            const maybeColorVariableId = parseIntOrUndefined(colorVariableId)
            if (maybeColorVariableId !== undefined)
                dimensions.push({
                    variableId: maybeColorVariableId,
                    property: DimensionProperty.color,
                })
        }
        if (sizeVariableId) {
            const maybeSizeVariableId = parseIntOrUndefined(sizeVariableId)
            if (maybeSizeVariableId !== undefined)
                dimensions.push({
                    variableId: maybeSizeVariableId,
                    property: DimensionProperty.size,
                })
        }

        // Slugs that are used to create a chart refer to columns derived from variables
        // by a transform string (e.g. 'multiplyBy 539022 2'). To render such a chart, we
        // need to download the data for all variables the transformed columns depend on
        // and construct an appropriate Grapher table. This is done in three steps:
        //   1. find all variables that the transformed columns depend on and add them to
        //      the config's dimensions array
        //   2. download data and metadata of the variables
        //   3. append the transformed columns to the Grapher table (note that this includes
        //      intermediate columns that are defined for multi-step transforms but are not
        //      referred to in any Grapher row)

        // all slugs specified by the author in the explorer config
        const uniqueSlugsInGrapherRow = _.uniq(
            [...ySlugs.split(" "), xSlug, colorSlug, sizeSlug].filter(
                _.identity
            )
        ) as string[]

        // find all variables that the transformed columns depend on and add them to the dimensions array
        if (uniqueSlugsInGrapherRow.length) {
            const baseVariableIds = _.uniq(
                uniqueSlugsInGrapherRow.flatMap((slug) =>
                    this.getBaseVariableIdsForColumnWithTransform(slug)
                )
            )
                .map((id) => parseInt(id, 10))
                .filter((id) => !isNaN(id))
            baseVariableIds.forEach((variableId) => {
                const hasDimension = dimensions.some(
                    (d) => d.variableId === variableId
                )
                if (!hasDimension) {
                    dimensions.push({
                        variableId: variableId,
                        property: DimensionProperty.table, // no specific dimension
                    })
                }
            })
        }

        config.dimensions = dimensions
        if (ySlugs && yVariableIds) config.ySlugs = ySlugs + " " + yVariableIds

        this.inputTableTransformer = (table: OwidTable) => {
            // add transformed (and intermediate) columns to the grapher table
            if (uniqueSlugsInGrapherRow.length) {
                const allColumnSlugs = _.uniq(
                    uniqueSlugsInGrapherRow.flatMap((slug) => [
                        ...this.getBaseColumnsForColumnWithTransform(slug),
                        slug,
                    ])
                )
                const existingColumnSlugs = table.columnSlugs
                const outstandingColumnSlugs = allColumnSlugs.filter(
                    (slug) => !existingColumnSlugs.includes(slug)
                )
                const requiredColumnDefs = outstandingColumnSlugs
                    .map(
                        (slug) =>
                            this.columnDefsWithoutTableSlugByIdOrSlug[slug]
                    )
                    .filter(_.identity)
                table = table.appendColumns(requiredColumnDefs)
            }

            // update column definitions with manually provided properties
            table = table.updateDefs((def: OwidColumnDef) => {
                const manuallyProvidedDef =
                    this.columnDefsWithoutTableSlugByIdOrSlug[def.slug] ?? {}
                const mergedDef = { ...def, ...manuallyProvidedDef }

                // update display properties
                mergedDef.display ??= {}
                if (manuallyProvidedDef.name)
                    mergedDef.display.name = manuallyProvidedDef.name
                if (manuallyProvidedDef.unit)
                    mergedDef.display.unit = manuallyProvidedDef.unit
                if (manuallyProvidedDef.shortUnit)
                    mergedDef.display.shortUnit = manuallyProvidedDef.shortUnit

                return mergedDef
            })
            return table
        }

        grapherState.setAuthoredVersion(config)
        grapherState.reset()
        grapherState.updateFromObject(config)
        if (dimensions.length === 0) {
            // If dimensions are empty, explicitly set the table to an empty table
            // so we don't end up confusingly showing stale data from a previous chart
            grapherState.inputTable = BlankOwidTable()
        } else {
            const inputTable = await fetchInputTableForConfig(
                config.dimensions,
                config.selectedEntityColors,
                this.props.dataApiUrl,
                undefined,
                this.props.isPreview,
                this.props.loadMetadataOnly
            )
            if (inputTable)
                grapherState.inputTable = this.inputTableTransformer(inputTable)
        }
    }

    @action.bound updateGrapherFromExplorerUsingColumnSlugs() {
        const grapherState = this.grapherState
        const { tableSlug } = this.explorerProgram.explorerGrapherConfig

        const config: GrapherProgrammaticInterface = {
            ...this.explorerProgram.grapherConfig,
            bakedGrapherURL: this.bakedBaseUrl,
            adminBaseUrl: this.adminBaseUrl,
            hideEntityControls: this.showExplorerControls,
            enableMapSelection: this.enableMapSelection,
        }

        // if not empty, respect the explorer's selection
        if (this.selection.hasSelection) {
            config.selectedEntityNames = this.selection.selectedEntityNames
        }

        grapherState.setAuthoredVersion(config)
        grapherState.reset()
        grapherState.updateFromObject(config)

        // Clear any error messages, they are likely to be related to dataset loading.
        this.grapher?.clearErrors()
        // Set a table immediately. A BlankTable shows a loading animation.
        this.setGrapherTable(
            BlankOwidTable(tableSlug, `Loading table '${tableSlug}'`)
        )
        void this.futureGrapherTable.set(this.tableLoader.get(tableSlug))
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
        if (
            typeof window !== "undefined" &&
            window.location.href.includes(EXPLORERS_PREVIEW_ROUTE)
        )
            localStorage.setItem(
                UNSAVED_EXPLORER_PREVIEW_QUERYPARAMS +
                    this.explorerProgram.slug,
                JSON.stringify(this.currentChoiceParams)
            )

        let url = Url.fromQueryParams(
            omitUndefinedValues({
                ...this.grapherState.changedParams,
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
        const debouncedPushParams = _.debounce(pushParams, 100)

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

    onChangeChoice = (choiceTitle: string) => async (value: string) => {
        const { currentlySelectedGrapherRow } = this.explorerProgram
        this.explorerProgram.decisionMatrix.setValueCommand(choiceTitle, value)
        if (currentlySelectedGrapherRow)
            await this.reactToUserChangingSelection(currentlySelectedGrapherRow)
    }

    private renderHeaderElement() {
        return (
            <div className="ExplorerHeaderBox">
                <div className="ExplorerTitle">
                    {this.explorerProgram.explorerTitle} Data Explorer
                </div>
                <div className="ExplorerSubtitle">
                    <MarkdownTextWrap
                        fontSize={12}
                        text={this.explorerProgram.explorerSubtitle || ""}
                    />
                </div>
                {this.explorerProgram.downloadDataLink && (
                    <a
                        href={this.explorerProgram.downloadDataLink}
                        target="_blank"
                        rel="noopener"
                        className="ExplorerDownloadLink"
                    >
                        Download this dataset
                    </a>
                )}
            </div>
        )
    }

    private isNarrow = isNarrow()

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

    private grapherContainerRef = React.createRef<HTMLDivElement>()

    private grapherRef = React.createRef<Grapher>()

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
        const selection =
            this.grapherState.isOnMapTab && this.enableMapSelection
                ? this.grapherState.mapConfig.selection
                : this.selection

        return (
            <EntityPicker
                key="entityPicker"
                manager={this}
                selection={selection}
                onSelectEntity={this.grapherState.onSelectEntity}
                onDeselectEntity={this.grapherState.onDeselectEntity}
                onClearEntities={this.grapherState.onClearEntities}
                isDropdownMenu={this.isNarrow}
            />
        )
    }

    @action.bound private toggleMobileControls() {
        this.showMobileControlsPopup = !this.showMobileControlsPopup
    }

    @action.bound private onResize() {
        // Don't bother rendering if the container is hidden
        // see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
        if (this.grapherContainerRef.current?.offsetParent === null) return

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
            this.grapherState.externalBounds = new Bounds(
                0,
                0,
                grapherContainer.clientWidth,
                grapherContainer.clientHeight
            )
    }

    private showMobileControlsPopup = false
    private get mobileCustomizeButton() {
        return (
            <a
                className="btn btn-primary mobile-button"
                onClick={this.toggleMobileControls}
                data-track-note="explorer_customize_chart_mobile"
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

    override render() {
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
                        ref={this.grapherRef}
                        grapherState={this.grapherState}
                    />
                </div>
            </div>
        )
    }

    @computed get editUrl() {
        return `${EXPLORERS_ROUTE_FOLDER}/${this.props.slug}`
    }

    @computed get baseUrl() {
        return `${this.bakedBaseUrl}/${EXPLORERS_ROUTE_FOLDER}/${this.props.slug}`
    }

    @computed get canonicalUrl() {
        return this.props.canonicalUrl ?? this.currentUrl.fullUrl
    }

    @computed get grapherTable() {
        return this.grapherState?.tableAfterAuthorTimelineAndEntityFilter
    }

    entityPickerMetric: string | undefined =
        this.initialQueryParams.pickerMetric
    entityPickerSort: SortOrder | undefined = this.initialQueryParams.pickerSort

    entityPickerTable: OwidTable | undefined = undefined
    entityPickerTableIsLoading: boolean = false

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
        // If we don't currently have a entity picker metric, then set pickerTable to the currently-used table anyways,
        // so that when we start sorting by entity name we can infer that the column is a string column immediately.
        const tableSlugToLoad = this.entityPickerMetric
            ? this.getTableSlugOfColumnSlug(this.entityPickerMetric)
            : this.explorerProgram.explorerGrapherConfig.tableSlug

        this.entityPickerTableIsLoading = true
        void this.futureEntityPickerTable.set(
            this.tableLoader.get(tableSlugToLoad)
        )
    }

    setEntityPicker({
        metric,
        sort,
    }: {
        metric: string | undefined
        sort?: SortOrder
    }) {
        this.entityPickerMetric = metric
        if (sort) this.entityPickerSort = sort
    }

    private tableSlugHasColumnSlug(
        tableSlug: TableSlug | undefined,
        columnSlug: ColumnSlug,
        columnDefsByTableSlug: Map<TableSlug | undefined, CoreColumnDef[]>
    ) {
        return !!columnDefsByTableSlug
            .get(tableSlug)
            ?.find((def) => def.slug === columnSlug)
    }

    private getTableSlugOfColumnSlug(
        columnSlug: ColumnSlug
    ): TableSlug | undefined {
        const columnDefsByTableSlug = this.explorerProgram.columnDefsByTableSlug

        // In most cases, column slugs will be duplicated in the tables, e.g. entityName.
        // Prefer the current Grapher table if it contains the column slug.
        const grapherTableSlug =
            this.explorerProgram.explorerGrapherConfig.tableSlug
        if (
            this.tableSlugHasColumnSlug(
                grapherTableSlug,
                columnSlug,
                columnDefsByTableSlug
            )
        ) {
            return grapherTableSlug
        }
        // ...otherwise, search all tables for the column slug
        return this.explorerProgram.tableSlugs.find((tableSlug) =>
            this.tableSlugHasColumnSlug(
                tableSlug,
                columnSlug,
                columnDefsByTableSlug
            )
        )
    }

    @computed get entityPickerColumnDefs(): CoreColumnDef[] {
        const allColumnDefs = _.uniqBy(
            Array.from(
                this.explorerProgram.columnDefsByTableSlug.values()
            ).flat(),
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
                    (def.type === undefined ||
                        !discardColumnTypes.has(def.type)) &&
                    def.slug !== undefined
            )
        }
    }

    @computed get requiredColumnSlugs() {
        return this.grapherState?.newSlugs ?? []
    }
}
