import React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    runInAction,
    action,
    reaction,
    IReactionDisposer,
} from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import {
    Bounds,
    capitalize,
    DetailDictionary,
    get,
    set,
    groupBy,
    extractDetailsFromSyntax,
    getIndexableKeys,
} from "@ourworldindata/utils"
import {
    GrapherInterface,
    GrapherStaticFormat,
    DimensionProperty,
} from "@ourworldindata/types"
import { Grapher } from "@ourworldindata/grapher"
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
import { EditorInheritanceTab } from "./EditorInheritanceTab.js"
import { EditorDebugTab } from "./EditorDebugTab.js"
import { SaveButtons } from "./SaveButtons.js"
import { LoadingBlocker } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
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
import { isIndicatorChartEditorInstance } from "./IndicatorChartEditor.js"

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
    @observable.ref namespaces: Namespace[]
    @observable.ref variableUsageCounts: Map<number, number> = new Map()
    @observable dataByNamespace: Map<string, NamespaceData> = new Map()

    constructor(json: any) {
        this.namespaces = json.namespaces
    }
}

export type DetailReferences = Record<FieldWithDetailReferences, string[]>

export interface ChartEditorViewManager<Editor> {
    admin: Admin
    editor: Editor
}

@observer
export class ChartEditorView<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    manager: ChartEditorViewManager<Editor>
}> {
    @observable.ref database = new EditorDatabase({})
    @observable details: DetailDictionary = {}
    @observable.ref grapherElement?: React.ReactElement

    @observable simulateVisionDeficiency?: VisionDeficiency

    @computed private get manager(): ChartEditorViewManager<Editor> {
        return this.props.manager
    }

    @observable private _isDbSet = false
    @observable private _isGrapherSet = false
    @computed get isReady(): boolean {
        return this._isDbSet && this._isGrapherSet
    }

    @action.bound private updateGrapher(): void {
        const config = this.manager.editor.originalGrapherConfig
        const grapherConfig = {
            ...config,
            // binds the grapher instance to this.grapher
            getGrapherInstance: (grapher: Grapher) => {
                this.manager.editor.grapher = grapher
            },
            dataApiUrlForAdmin:
                this.manager.admin.settings.DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
            bounds: this.bounds,
            staticFormat: this.staticFormat,
        }
        this.manager.editor.grapher.renderToStatic =
            !!this.editor?.showStaticPreview
        this.grapherElement = <Grapher {...grapherConfig} />
        this._isGrapherSet = true
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

        const groupedByNamespace = groupBy(
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
        await runDetailsOnDemand()

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
            : this.manager.editor.grapher.defaultBounds
    }

    @computed private get staticFormat(): GrapherStaticFormat {
        return this.isMobilePreview
            ? GrapherStaticFormat.square
            : GrapherStaticFormat.landscape
    }

    // unvalidated terms extracted from the subtitle and note fields
    // these may point to non-existent details e.g. ["not_a_real_term", "pvotery"]
    @computed
    get currentDetailReferences(): DetailReferences {
        const { grapher } = this.manager.editor
        return {
            subtitle: extractDetailsFromSyntax(grapher.currentSubtitle),
            note: extractDetailsFromSyntax(grapher.note ?? ""),
            axisLabelX: extractDetailsFromSyntax(
                grapher.xAxisConfig.label ?? ""
            ),
            axisLabelY: extractDetailsFromSyntax(
                grapher.yAxisConfig.label ?? ""
            ),
        }
    }

    // the actual Detail objects, indexed by category.term
    @computed get currentlyReferencedDetails(): GrapherInterface["details"] {
        const grapherConfigDetails: GrapherInterface["details"] = {}
        const allReferences = Object.values(this.currentDetailReferences).flat()

        allReferences.forEach((term) => {
            const detail = get(this.details, term)
            if (detail) {
                set(grapherConfigDetails, term, detail)
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
                        `Invalid detail(s) specified: ${references.join(", ")}`
                }
            }
        )

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

        this.manager.editor.grapher.dimensionSlots.forEach((slot) => {
            slot.dimensions.forEach((dimension, dimensionIndex) => {
                const details = extractDetailsFromSyntax(
                    dimension.display.name ?? ""
                )
                const hasDetailsInDisplayName = details.length > 0

                // add error message if details are referenced in the display name
                if (hasDetailsInDisplayName) {
                    errorMessages[slot.property][dimensionIndex] = {
                        displayName: "Detail syntax is not supported",
                    }
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

    componentDidMount(): void {
        this.refresh()
        this.updateGrapher()

        this.disposers.push(
            reaction(
                () => this.editor && this.editor.previewMode,
                () => {
                    if (this.editor) {
                        localStorage.setItem(
                            "editorPreviewMode",
                            this.editor.previewMode
                        )
                    }
                    this.updateGrapher()
                }
            )
        )
    }

    disposers: IReactionDisposer[] = []
    componentWillUnmount(): void {
        this.disposers.forEach((dispose) => dispose())
    }

    render(): React.ReactElement {
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
        const { grapher, availableTabs } = editor

        const chartEditor = isChartEditorInstance(editor) ? editor : undefined
        const indicatorChartEditor = isIndicatorChartEditorInstance(editor)
            ? editor
            : undefined

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
                                            this.updateGrapher()
                                        }}
                                    >
                                        {capitalize(tab)}
                                        {tab === "inheritance" &&
                                            chartEditor &&
                                            chartEditor.isInheritanceEnabled &&
                                            " (enabled)"}
                                        {tab === "refs" &&
                                        chartEditor?.references
                                            ? ` (${getFullReferencesCount(
                                                  chartEditor.references
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
                            <EditorScatterTab grapher={grapher} />
                        )}
                        {editor.tab === "marimekko" && (
                            <EditorMarimekkoTab grapher={grapher} />
                        )}
                        {editor.tab === "map" && (
                            <EditorMapTab editor={editor} />
                        )}
                        {chartEditor && chartEditor.tab === "revisions" && (
                            <EditorHistoryTab editor={chartEditor} />
                        )}
                        {chartEditor && chartEditor.tab === "refs" && (
                            <EditorReferencesTab editor={chartEditor} />
                        )}
                        {indicatorChartEditor &&
                            indicatorChartEditor.tab === "inheritance" && (
                                <EditorInheritanceTab
                                    editor={indicatorChartEditor}
                                />
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
                    <figure
                        data-grapher-src
                        style={{
                            minHeight: editor.showStaticPreview
                                ? grapher.staticBoundsWithDetails.height
                                : undefined,
                            boxShadow: editor.showStaticPreview
                                ? "0px 4px 40px rgba(0, 0, 0, 0.2)"
                                : undefined,
                            filter:
                                this.simulateVisionDeficiency &&
                                `url(#${this.simulateVisionDeficiency.id})`,
                        }}
                    >
                        {this.grapherElement}
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
