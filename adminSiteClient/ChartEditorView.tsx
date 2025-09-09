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
} from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import {
    Bounds,
    DetailDictionary,
    extractDetailsFromSyntax,
    getIndexableKeys,
} from "@ourworldindata/utils"
import { GrapherInterface, DimensionProperty } from "@ourworldindata/types"
import {
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    Grapher,
    GrapherState,
    hasValidConfigForBinningStrategy,
} from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import { getFullReferencesCount, isChartEditorInstance } from "./ChartEditor.js"
import { EditorBasicTab } from "./EditorBasicTab.js"
import { EditorDataTab } from "./EditorDataTab.js"
import { EditorTextTab } from "./EditorTextTab.js"
import { EditorCustomizeTab } from "./EditorCustomizeTab.js"
import { EditorScatterTab } from "./EditorScatterTab.js"
import { EditorMapTab } from "./EditorMapTab.js"
import { EditorHistoryTab } from "./EditorHistoryTab.js"
import { EditorReferencesTab } from "./EditorReferencesTab.js"
import { EditorDebugTab } from "./EditorDebugTab.js"
import { SaveButtons } from "./SaveButtons.js"
import { LoadingBlocker } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
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
import { runDetailsOnDemand } from "../site/detailsOnDemand.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
    FieldWithDetailReferences,
} from "./ChartEditorTypes.js"

interface Variable {
    id: number
    name: string
}

export interface Dataset {
    id: number
    name: string
    namespace: string
    version: string | undefined
    variables: Variable[]
    isPrivate: boolean
    nonRedistributable: boolean
}

export interface Namespace {
    name: string
    description?: string
    isArchived: boolean
}

// This contains the dataset/variable metadata for the entire database
// Used for variable selector interface
export interface NamespaceData {
    datasets: Dataset[]
}

export class EditorDatabase {
    namespaces: Namespace[]
    variableUsageCounts: Map<number, number> = new Map()
    dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(json: any) {
        makeObservable(this, {
            namespaces: observable.ref,
            variableUsageCounts: observable.ref,
            dataByNamespace: observable,
        })
        this.namespaces = json.namespaces
    }
}

export type DetailReferences = Record<FieldWithDetailReferences, string[]>

export interface ChartEditorViewManager<Editor> {
    admin: Admin
    editor: Editor
}

interface ChartEditorViewProps<Editor> {
    manager: ChartEditorViewManager<Editor>
}

@observer
export class ChartEditorView<
    Editor extends AbstractChartEditor,
> extends React.Component<ChartEditorViewProps<Editor>> {
    database = new EditorDatabase({})
    details: DetailDictionary = {}

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
    @action.bound async updateGrapher(): Promise<void> {
        const config = this.manager.editor.originalGrapherConfig
        this.manager.editor.grapherState.updateFromObject(config)
        await this.manager.editor.reloadGrapherData()
        this.grapherState.externalBounds = this.bounds
    }

    @action.bound private setDb(json: any): void {
        this.database = new EditorDatabase(json)
        this._isDbSet = true
    }

    async fetchData(): Promise<void> {
        const { admin } = this.manager

        const [namespaces, variables] = await Promise.all([
            admin.getJSON(`/api/editorData/namespaces.json`),
            admin.getJSON(`/api/editorData/variables.json`),
        ])

        this.setDb(namespaces)

        const groupedByNamespace = _.groupBy(
            variables.datasets,
            (d) => d.namespace
        )
        for (const namespace in groupedByNamespace) {
            this.database.dataByNamespace.set(namespace, {
                datasets: groupedByNamespace[namespace] as Dataset[],
            })
        }

        const usageData = (await admin.getJSON(
            `/api/variables.usages.json`
        )) as {
            variableId: number
            usageCount: number
        }[]
        this.database.variableUsageCounts = new Map(
            usageData.map(({ variableId, usageCount }) => [
                variableId,
                +usageCount,
            ])
        )
    }

    async fetchDetails(): Promise<void> {
        await runDetailsOnDemand({ shouldFetchFromAdminApi: true })

        runInAction(() => {
            if (window.details) this.details = window.details
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
            subtitle: extractDetailsFromSyntax(grapherState.currentSubtitle),
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

        // The origin url can either be a full URL (with optional https protocol), or a relative
        // URL starting with /.
        // We could combine them into one regex, but then it's harder to read.
        const originUrlRegex = [/^(https?:\/\/)?[^/.]+\.[^/].+$/, /^\/.+$/]

        if (
            this.grapherState.originUrl &&
            !originUrlRegex.some((regex) =>
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

    @computed get editor(): Editor | undefined {
        if (!this.isReady) return undefined

        return this.manager.editor
    }

    @action.bound refresh(): void {
        void this.fetchDetails()
        void this.fetchData()
    }

    override componentDidMount(): void {
        this.refresh()
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
    }

    disposers: IReactionDisposer[] = []
    override componentWillUnmount(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    override render(): React.ReactElement {
        return (
            <AdminLayout noSidebar>
                <main className="ChartEditorPage">
                    {(this.editor === undefined ||
                        this.editor.currentRequest) && <LoadingBlocker />}
                    {this.editor !== undefined && this.renderReady(this.editor)}
                </main>
            </AdminLayout>
        )
    }

    renderReady(editor: Editor): React.ReactElement {
        const { grapherState, availableTabs } = editor

        const chartEditor = isChartEditorInstance(editor) ? editor : undefined

        return (
            <>
                {!editor.isNewGrapher && (
                    <Prompt
                        when={editor.isModified}
                        message="Are you sure you want to leave? Unsaved changes will be lost."
                    />
                )}
                {chartEditor?.newChartId && (
                    <Redirect to={`/charts/${chartEditor.newChartId}/edit`} />
                )}
                <div className="chart-editor-settings">
                    <div className="p-2">
                        <ul className="nav nav-tabs">
                            {availableTabs.map((tab) => (
                                <li key={tab} className="nav-item">
                                    <a
                                        className={
                                            "nav-link" +
                                            (tab === editor.tab
                                                ? " active"
                                                : "")
                                        }
                                        onClick={() => {
                                            editor.tab = tab
                                            editor.showStaticPreview =
                                                tab === "export"
                                        }}
                                    >
                                        {_.capitalize(tab)}
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
                        {editor.tab === "basic" && (
                            <EditorBasicTab
                                editor={editor}
                                database={this.database}
                                errorMessagesForDimensions={
                                    this.errorMessagesForDimensions
                                }
                            />
                        )}
                        {editor.tab === "text" && (
                            <EditorTextTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {editor.tab === "data" && (
                            <EditorDataTab editor={editor} />
                        )}
                        {editor.tab === "customize" && (
                            <EditorCustomizeTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {editor.tab === "scatter" && (
                            <EditorScatterTab editor={editor} />
                        )}
                        {editor.tab === "marimekko" && (
                            <EditorMarimekkoTab grapherState={grapherState} />
                        )}
                        {editor.tab === "map" && (
                            <EditorMapTab
                                editor={editor}
                                errorMessages={this.errorMessages}
                            />
                        )}
                        {chartEditor && chartEditor.tab === "revisions" && (
                            <EditorHistoryTab editor={chartEditor} />
                        )}
                        {editor.tab === "refs" && (
                            <EditorReferencesTab editor={editor} />
                        )}
                        {editor.tab === "export" && (
                            <EditorExportTab editor={editor} />
                        )}
                        {editor.tab === "debug" && (
                            <EditorDebugTab editor={editor} />
                        )}
                    </div>
                    {editor.tab !== "export" && (
                        <SaveButtons
                            editor={editor}
                            errorMessages={this.errorMessages}
                            errorMessagesForDimensions={
                                this.errorMessagesForDimensions
                            }
                        />
                    )}
                </div>
                <div className="chart-editor-view">
                    {grapherState.id && (
                        <a
                            className="preview"
                            href={`/admin/charts/${grapherState.id}/preview`}
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
