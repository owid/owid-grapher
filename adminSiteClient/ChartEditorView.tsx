import * as _ from "lodash-es"
import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    action,
    reaction,
    IReactionDisposer,
    makeObservable,
    comparer,
} from "mobx"
import { Prompt } from "react-router-dom"
import {
    Bounds,
    DetailDictionary,
    excludeUndefined,
    extractDetailsFromSyntax,
    getIndexableKeys,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    GrapherQueryParams,
    DimensionProperty,
    ORIGIN_URL_REGEX_PATTERNS,
} from "@ourworldindata/types"
import { initializeDetailsOnDemand } from "@ourworldindata/components"
import {
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    Grapher,
    GrapherState,
    hasValidConfigForBinningStrategy,
} from "@ourworldindata/grapher"
import { getFullReferencesCount } from "./adminChartApi.js"
import { isConfigEditorInstance } from "./ConfigEditor.js"
import { EditorBasicTab } from "./EditorBasicTab.js"
import { EditorDataTab } from "./EditorDataTab.js"
import { EditorTextTab } from "./EditorTextTab.js"
import { EditorCustomizeTab } from "./EditorCustomizeTab.js"
import { EditorScatterTab } from "./EditorScatterTab.js"
import { EditorMapTab } from "./EditorMapTab.js"
import { EditorReferencesTab } from "./EditorReferencesTab.js"
import { EditorDebugTab } from "./EditorDebugTab.js"
import { SaveButtons } from "./SaveButtons.js"
import { LoadingBlocker } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faMobile, faDesktop } from "@fortawesome/free-solid-svg-icons"
import {
    VisionDeficiency,
    VisionDeficiencySvgFilters,
    VisionDeficiencyDropdown,
    VisionDeficiencyEntity,
} from "./VisionDeficiencies.js"
import { EditorMarimekkoTab } from "./EditorMarimekkoTab.js"
import { EditorExportTab } from "./EditorExportTab.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
    FieldWithDetailReferences,
} from "./ChartEditorTypes.js"
import { EditorDatabase } from "./EditorDatabase.js"
import { DetailsProvider, IndicatorCatalog } from "./editorProviders.js"

export type DetailReferences = Record<FieldWithDetailReferences, string[]>

export interface ChartEditorViewManager<Editor> {
    editor: Editor
    /** Indicators the variable selector can offer. Absent → none. */
    indicators?: IndicatorCatalog
    /** Details on demand, for validating text fields. Absent → none. */
    details?: DetailsProvider
    /**
     * Query params to apply to the grapher once, after the initial data load.
     * Used when creating a narrative chart from a customized chart, so that the
     * editor opens on the state the user was looking at. Managers that don't
     * set it get the authored config as before.
     */
    initialQueryParams?: GrapherQueryParams
}

interface ChartEditorViewProps<Editor> {
    manager: ChartEditorViewManager<Editor>
}

@observer
export class ChartEditorView<
    Editor extends AbstractChartEditor,
> extends React.Component<ChartEditorViewProps<Editor>> {
    database = EditorDatabase.empty()
    details: DetailDictionary = {}
    private cleanupDetailsOnDemand: (() => void) | undefined

    constructor(props: ChartEditorViewProps<Editor>) {
        super(props)

        makeObservable<ChartEditorView<Editor>, "_isDbSet">(this, {
            database: observable.ref,
            details: observable,
            simulateVisionDeficiency: observable,
            _isDbSet: observable,
        })
    }

    @computed get grapherState(): GrapherState {
        return this.manager.editor.grapherState
    }

    simulateVisionDeficiency: VisionDeficiency | undefined = undefined

    @computed private get manager(): ChartEditorViewManager<Editor> {
        return this.props.manager
    }

    private _isDbSet = false
    @computed get isReady(): boolean {
        return this._isDbSet
    }

    private hasAppliedInitialQueryParams = false

    @action.bound async updateGrapher(): Promise<void> {
        const config = this.manager.editor.originalGrapherConfig
        this.manager.editor.grapherState.updateFromObject(config)
        await this.manager.editor.reloadGrapherData()
        this.grapherState.externalBounds = this.bounds

        // Applied after the data load because the time bounds are snapped to
        // the available times and the entity selection is gated on
        // `addCountryMode`. Applied at most once: `updateGrapher` re-runs
        // whenever the editor changes, and re-applying would overwrite edits
        // made in the editor since.
        const { initialQueryParams } = this.manager
        if (initialQueryParams && !this.hasAppliedInitialQueryParams) {
            this.hasAppliedInitialQueryParams = true
            this.grapherState.populateFromQueryParams(initialQueryParams)
        }
    }

    @action.bound private setDb(database: EditorDatabase): void {
        this.database = database
        this._isDbSet = true
    }

    async fetchData(): Promise<void> {
        const { indicators } = this.manager
        const catalog = indicators
            ? await indicators.load()
            : { namespaces: [], datasets: [] }
        this.setDb(new EditorDatabase(catalog))
    }

    async fetchDetails(): Promise<void> {
        const details = (await this.manager.details?.load()) ?? {}

        this.cleanupDetailsOnDemand = initializeDetailsOnDemand({ details })

        runInAction(() => {
            this.details = details
        })
    }

    @computed private get isMobilePreview(): boolean {
        return this.editor?.previewMode === "mobile"
    }

    @computed private get bounds(): Bounds {
        return this.isMobilePreview
            ? new Bounds(0, 0, 380, 525)
            : this.grapherState.defaultBounds
    }
    @computed private get staticBounds(): Bounds {
        return this.isMobilePreview
            ? DEFAULT_GRAPHER_BOUNDS_SQUARE
            : DEFAULT_GRAPHER_BOUNDS
    }

    // unvalidated terms extracted from the subtitle and note fields
    // these may point to non-existent details e.g. ["not_a_real_term", "pvotery"]
    @computed
    get currentDetailReferences(): DetailReferences {
        const { grapherState } = this.manager.editor
        return {
            subtitle: extractDetailsFromSyntax(grapherState.effectiveSubtitle),
            note: extractDetailsFromSyntax(grapherState.note ?? ""),
            axisLabelX: extractDetailsFromSyntax(
                grapherState.xAxisConfig.label ?? ""
            ),
            axisLabelY: extractDetailsFromSyntax(
                grapherState.yAxisConfig.label ?? ""
            ),
        }
    }

    // the actual Detail objects, indexed by category.term
    @computed get currentlyReferencedDetails(): GrapherInterface["details"] {
        const grapherConfigDetails: GrapherInterface["details"] = {}
        const allReferences = Object.values(this.currentDetailReferences).flat()

        allReferences.forEach((term) => {
            const detail = _.get(this.details, term)
            if (detail) {
                _.set(grapherConfigDetails, term, detail)
            }
        })

        return grapherConfigDetails
    }

    @computed
    get invalidDetailReferences(): DetailReferences {
        // Without a details provider there is nothing to validate against;
        // flagging every reference as invalid would block saving for hosts
        // that simply have no details on demand.
        if (!this.manager.details)
            return { subtitle: [], note: [], axisLabelX: [], axisLabelY: [] }
        const { subtitle, note, axisLabelX, axisLabelY } =
            this.currentDetailReferences
        return {
            subtitle: subtitle.filter((term) => !this.details[term]),
            note: note.filter((term) => !this.details[term]),
            axisLabelX: axisLabelX.filter((term) => !this.details[term]),
            axisLabelY: axisLabelY.filter((term) => !this.details[term]),
        }
    }

    @computed get errorMessages(): ErrorMessages {
        const { invalidDetailReferences } = this

        const errorMessages: ErrorMessages = {}

        // add error messages for each field with invalid detail references
        getIndexableKeys(invalidDetailReferences).forEach(
            (key: FieldWithDetailReferences) => {
                const references = invalidDetailReferences[key]
                if (references.length) {
                    errorMessages[key] =
                        `Invalid DoD(s) specified: ${references.join(", ")}`
                }
            }
        )

        // add an error message if any focused series names are invalid
        const { invalidFocusedSeriesNames = [] } = this.editor ?? {}
        if (invalidFocusedSeriesNames.length > 0) {
            const invalidNames = invalidFocusedSeriesNames.join(", ")
            const message = `Invalid focus state. The following entities/indicators are not plotted: ${invalidNames}`
            errorMessages.focusedSeriesNames = message
        }

        // Check the two colorScale configs (esp. binning strategies) for any errors
        const colorScaleKeys = ["colorScale", "map.colorScale"] as const
        colorScaleKeys.forEach((key) => {
            const colorScaleConfig = _.get(this.grapherState, key)

            if (colorScaleConfig.binningStrategy === "manual") return

            const validationResult = hasValidConfigForBinningStrategy(
                colorScaleConfig.binningStrategy,
                colorScaleConfig
            )
            if (!validationResult.valid) {
                errorMessages[`${key}.${validationResult.field}`] =
                    validationResult.reason
            }
        })

        if (
            this.grapherState.originUrl &&
            !ORIGIN_URL_REGEX_PATTERNS.some((regex) =>
                regex.test(this.grapherState.originUrl ?? "")
            )
        ) {
            errorMessages.originUrl =
                "Invalid origin URL. If it's a relative URL, make sure it starts with /"
        }

        return errorMessages
    }

    @computed
    get errorMessagesForDimensions(): ErrorMessagesForDimensions {
        const errorMessages: ErrorMessagesForDimensions = {
            [DimensionProperty.y]: [],
            [DimensionProperty.x]: [],
            [DimensionProperty.color]: [],
            [DimensionProperty.size]: [],
            [DimensionProperty.table]: [], // not used
        }

        this.grapherState.dimensionSlots.forEach((slot) => {
            slot.dimensions.forEach((dimension, dimensionIndex) => {
                const details = extractDetailsFromSyntax(
                    dimension.display.name ?? ""
                )
                const hasDetailsInDisplayName = details.length > 0

                // add error message if details are referenced in the display name
                if (hasDetailsInDisplayName) {
                    errorMessages[slot.property][dimensionIndex] =
                        `Detail syntax is not supported for display names of indicators: ${dimension.display.name}`
                }
            })
        })

        return errorMessages
    }

    /** Everything that currently blocks saving, as messages. */
    @computed get editingErrors(): string[] {
        return excludeUndefined([
            ...Object.values(this.errorMessages),
            ...Object.values(this.errorMessagesForDimensions).flat(),
        ])
    }

    @computed get editor(): Editor | undefined {
        if (!this.isReady) return undefined

        return this.manager.editor
    }

    @action.bound refresh(): void {
        void this.fetchDetails()
        void this.fetchData()
    }

    override componentDidMount(): void {
        // Register the reactions before kicking off the fetches: without an
        // indicator catalog to await, `fetchData` marks the view ready
        // synchronously, and a reaction set up afterwards would never see
        // the editor appear.
        this.disposers.push(
            reaction(
                () => this.editor,
                () => {
                    void this.updateGrapher()
                }
            )
        )
        this.disposers.push(
            reaction(
                () => this.editor && this.editor.previewMode,
                () => {
                    this.grapherState.staticBounds = this.staticBounds
                    this.grapherState.externalBounds = this.bounds
                }
            )
        )
        this.disposers.push(
            reaction(
                () => this.editor?.fullConfig,
                () => {
                    // Update the authoredVersion, as it's being used for "author's minTime & maxTime" in some places.
                    if (this.editor?.fullConfig)
                        this.editor?.grapherState.setAuthoredVersion(
                            this.editor?.fullConfig
                        )
                },
                { equals: comparer.structural }
            )
        )
        this.refresh()
    }

    disposers: IReactionDisposer[] = []
    override componentWillUnmount(): void {
        this.disposers.forEach((dispose) => dispose())
        this.cleanupDetailsOnDemand?.()
        this.editor?.dispose()
    }

    override render(): React.ReactElement {
        return (
            <main className="ChartEditorPage">
                <LoadingBlocker
                    isLoading={
                        this.editor === undefined ||
                        !!this.editor.currentRequest
                    }
                />
                {this.editor !== undefined && this.renderReady(this.editor)}
            </main>
        )
    }

    renderReady(editor: Editor): React.ReactElement {
        const { grapherState, availableTabs } = editor
        // The editor's tab may name one that isn't available right now: a
        // host allow-list without "basic", or a `?tab=map` from the URL
        // before the config has loaded. Show the first available one instead
        // without touching `editor.tab`, so the URL's intent survives.
        const activeTab = availableTabs.includes(editor.tab)
            ? editor.tab
            : availableTabs[0]

        // Hosts of the config-only editor plug their own tabs, save buttons
        // and preview link in; the admin's chart-record editors get the
        // built-in ones.
        const configEditor = isConfigEditorInstance(editor) ? editor : undefined
        const extraTabs = configEditor?.manager.extraTabs ?? []
        const activeExtraTab = extraTabs.find((tab) => tab.key === editor.tab)
        const tabLabel = (tab: string): React.ReactNode =>
            extraTabs.find((t) => t.key === tab)?.label ?? _.capitalize(tab)
        // A config that carries a chart id came from the admin database, so
        // the admin's preview page can show it.
        const previewUrl = grapherState.id
            ? `/admin/charts/${grapherState.id}/preview`
            : undefined

        return (
            <>
                {!editor.isNewGrapher && (
                    <Prompt
                        when={editor.isModified}
                        message="Are you sure you want to leave? Unsaved changes will be lost."
                    />
                )}
                <div className="chart-editor-settings">
                    <div className="p-2">
                        <ul className="nav nav-tabs">
                            {availableTabs.map((tab) => (
                                <li key={tab} className="nav-item">
                                    <a
                                        className={
                                            "nav-link" +
                                            (tab === activeTab ? " active" : "")
                                        }
                                        onClick={() => {
                                            editor.tab = tab
                                            editor.showStaticPreview =
                                                tab === "export"
                                        }}
                                    >
                                        {tabLabel(tab)}
                                        {tab === "refs" && editor?.references
                                            ? ` (${getFullReferencesCount(
                                                  editor.references
                                              )})`
                                            : ""}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="innerForm container">
                        {activeTab === "basic" && (
                            <EditorBasicTab
                                editor={editor}
                                database={this.database}
                                errorMessagesForDimensions={
                                    this.errorMessagesForDimensions
                                }
                            />
                        )}
                        {activeTab === "text" && (
                            <EditorTextTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {activeTab === "data" && (
                            <EditorDataTab editor={editor} />
                        )}
                        {activeTab === "customize" && (
                            <EditorCustomizeTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {activeTab === "scatter" && (
                            <EditorScatterTab editor={editor} />
                        )}
                        {activeTab === "marimekko" && (
                            <EditorMarimekkoTab grapherState={grapherState} />
                        )}
                        {activeTab === "map" && (
                            <EditorMapTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {activeExtraTab &&
                            configEditor &&
                            activeExtraTab.render(configEditor)}
                        {!activeExtraTab && activeTab === "refs" && (
                            <EditorReferencesTab editor={editor} />
                        )}
                        {activeTab === "export" && (
                            <EditorExportTab editor={editor} />
                        )}
                        {activeTab === "debug" && (
                            <EditorDebugTab editor={editor} />
                        )}
                    </div>
                    {activeTab !== "export" &&
                        (configEditor?.manager.renderSaveButtons ? (
                            configEditor.manager.renderSaveButtons(
                                configEditor,
                                this.editingErrors
                            )
                        ) : (
                            <SaveButtons
                                editor={editor}
                                errorMessages={this.errorMessages}
                                errorMessagesForDimensions={
                                    this.errorMessagesForDimensions
                                }
                            />
                        ))}
                </div>
                <div className="chart-editor-view">
                    {previewUrl && (
                        <a
                            className="preview"
                            href={previewUrl}
                            target="_blank"
                            rel="noopener"
                        >
                            View Grapher or Data page
                        </a>
                    )}
                    <figure
                        style={{
                            minHeight: editor.showStaticPreview
                                ? grapherState.staticBoundsWithDetails.height
                                : undefined,
                            boxShadow: editor.showStaticPreview
                                ? "0px 4px 40px rgba(0, 0, 0, 0.2)"
                                : undefined,
                            filter:
                                this.simulateVisionDeficiency &&
                                `url(#${this.simulateVisionDeficiency.id})`,
                        }}
                    >
                        <Grapher grapherState={this.grapherState} />
                    </figure>
                    <div>
                        <div
                            className="btn-group"
                            data-toggle="buttons"
                            style={{ whiteSpace: "nowrap" }}
                        >
                            <label
                                className={
                                    "btn btn-light" +
                                    (this.isMobilePreview ? " active" : "")
                                }
                                title="Mobile preview"
                            >
                                <input
                                    type="radio"
                                    onChange={action(() => {
                                        editor.previewMode = "mobile"
                                    })}
                                    name="previewSize"
                                    id="mobile"
                                    checked={this.isMobilePreview}
                                />{" "}
                                <FontAwesomeIcon icon={faMobile} />
                            </label>
                            <label
                                className={
                                    "btn btn-light" +
                                    (!this.isMobilePreview ? " active" : "")
                                }
                                title="Desktop preview"
                            >
                                <input
                                    onChange={action(() => {
                                        editor.previewMode = "desktop"
                                    })}
                                    type="radio"
                                    name="previewSize"
                                    id="desktop"
                                    checked={!this.isMobilePreview}
                                />{" "}
                                <FontAwesomeIcon icon={faDesktop} />
                            </label>
                        </div>
                        <div
                            className="form-group d-inline-block"
                            style={{ width: 250, marginLeft: 15 }}
                        >
                            Emulate vision deficiency:{" "}
                            <VisionDeficiencyDropdown
                                onChange={action(
                                    (option: VisionDeficiencyEntity) =>
                                        (this.simulateVisionDeficiency =
                                            option.deficiency)
                                )}
                            />
                        </div>
                    </div>

                    {/* Include svg filters necessary for vision deficiency emulation */}
                    <VisionDeficiencySvgFilters />
                </div>
            </>
        )
    }
}
