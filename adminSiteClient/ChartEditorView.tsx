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
import { ConfigEditor, EditorTabKey } from "./ConfigEditor.js"
import { EditorBasicTab } from "./EditorBasicTab.js"
import { EditorDataTab } from "./EditorDataTab.js"
import { EditorTextTab } from "./EditorTextTab.js"
import { EditorCustomizeTab } from "./EditorCustomizeTab.js"
import { EditorScatterTab } from "./EditorScatterTab.js"
import { EditorMapTab } from "./EditorMapTab.js"
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
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
    FieldWithDetailReferences,
} from "./ChartEditorTypes.js"
import { DetailsProvider } from "./editorProviders.js"

export type DetailReferences = Record<FieldWithDetailReferences, string[]>

export interface ChartEditorViewManager {
    editor: ConfigEditor
    details?: DetailsProvider
    initialQueryParams?: GrapherQueryParams
    previewUrl?: string
    /** Host content shown next to the preview link, e.g. a status badge */
    renderPreviewHeader?: (editor: ConfigEditor) => React.ReactNode
}

interface ChartEditorViewProps {
    manager: ChartEditorViewManager
}

@observer
export class ChartEditorView extends React.Component<ChartEditorViewProps> {
    details: DetailDictionary = {}
    private cleanupDetailsOnDemand: (() => void) | undefined
    private latestDetailsLoad = 0

    constructor(props: ChartEditorViewProps) {
        super(props)

        makeObservable<ChartEditorView, "isConfigApplied" | "isChartLoaded">(
            this,
            {
                details: observable,
                simulateVisionDeficiency: observable,
                isConfigApplied: observable,
                isChartLoaded: observable,
            }
        )
    }

    @computed get grapherState(): GrapherState {
        return this.manager.editor.grapherState
    }

    simulateVisionDeficiency: VisionDeficiency | undefined = undefined

    @computed private get manager(): ChartEditorViewManager {
        return this.props.manager
    }

    // The tabs arm reactions on the chart as they mount, and React mounts them
    // before this view's componentDidMount, so they wait for the config
    private isConfigApplied = false
    // Until the data arrives, an edit would be marked as saved
    private isChartLoaded = false

    async loadInitialConfig(): Promise<void> {
        // Outside an action: creating the editor arms its reactions, which
        // inside one would first run after the config is applied and so
        // never report it through onChange
        const { editor } = this.manager
        runInAction(() => {
            editor.grapherState.updateFromObject(editor.originalGrapherConfig)
            this.isConfigApplied = true
            // Also before the await, so loading never counts as an edit
            editor.markAsSaved()
        })
        try {
            await this.manager.editor.reloadGrapherData()
        } finally {
            runInAction(() => {
                this.grapherState.externalBounds = this.bounds
                this.manager.editor.markAsSaved()
                this.isChartLoaded = true
            })
        }

        const { initialQueryParams } = this.manager
        if (initialQueryParams)
            this.grapherState.populateFromQueryParams(initialQueryParams)
    }

    async fetchDetails(): Promise<void> {
        const load = ++this.latestDetailsLoad
        const details = (await this.manager.details?.load()) ?? {}
        // Unmounted, or superseded by a newer load, in the meantime
        if (load !== this.latestDetailsLoad) return

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

    @computed get editingErrors(): string[] {
        return excludeUndefined([
            ...Object.values(this.errorMessages),
            ...Object.values(this.errorMessagesForDimensions).flat(),
        ])
    }

    @computed get editor(): ConfigEditor | undefined {
        if (!this.isConfigApplied) return undefined

        return this.manager.editor
    }

    override componentDidMount(): void {
        void this.loadInitialConfig()
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
        void this.fetchDetails()
    }

    disposers: IReactionDisposer[] = []
    override componentWillUnmount(): void {
        this.disposers.splice(0).forEach((dispose) => dispose())
        this.latestDetailsLoad++
        this.cleanupDetailsOnDemand?.()
    }

    override render(): React.ReactElement {
        return (
            <main className="ChartEditorPage">
                <LoadingBlocker isLoading={!this.isChartLoaded} />
                {this.editor !== undefined && this.renderReady(this.editor)}
            </main>
        )
    }

    private renderSaveButtons(editor: ConfigEditor): React.ReactNode {
        const { renderSaveButtons } = editor.manager
        if (renderSaveButtons)
            return renderSaveButtons(editor, this.editingErrors)
        return (
            <SaveButtons
                editor={editor}
                errorMessages={this.errorMessages}
                errorMessagesForDimensions={this.errorMessagesForDimensions}
            />
        )
    }

    renderReady(editor: ConfigEditor): React.ReactElement {
        const { grapherState, availableTabs } = editor
        const { previewUrl } = this.manager
        const previewHeader = this.manager.renderPreviewHeader?.(editor)
        const extraTabs = editor.manager.extraTabs ?? []

        const activeTab = availableTabs.includes(editor.tab)
            ? editor.tab
            : availableTabs[0]
        const activeExtraTab = extraTabs.find(
            (extraTab) => extraTab.key === activeTab
        )
        const tabLabel = (tab: EditorTabKey): React.ReactNode =>
            extraTabs.find((extraTab) => extraTab.key === tab)?.label ??
            _.capitalize(tab)

        return (
            <>
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
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="innerForm container">
                        {activeTab === "basic" && (
                            <EditorBasicTab
                                editor={editor}
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
                            <EditorMarimekkoTab editor={editor} />
                        )}
                        {activeTab === "map" && (
                            <EditorMapTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {activeExtraTab?.render(editor)}
                        {activeTab === "export" && (
                            <EditorExportTab editor={editor} />
                        )}
                        {activeTab === "debug" && (
                            <EditorDebugTab editor={editor} />
                        )}
                    </div>
                    {activeTab !== "export" && this.renderSaveButtons(editor)}
                </div>
                <div className="chart-editor-view">
                    {(previewUrl || previewHeader) && (
                        <div className="chart-editor-view__header">
                            {previewHeader}
                            {previewUrl && (
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener"
                                >
                                    View Grapher or Data page
                                </a>
                            )}
                        </div>
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
