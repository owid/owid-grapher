/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { observer } from "mobx-react"
import {
    observable,
    computed,
    action,
    reaction,
    IReactionDisposer,
    makeObservable,
} from "mobx"
import { Prompt, Redirect } from "react-router-dom"
import { Bounds } from "@ourworldindata/utils"
import {
    DEFAULT_GRAPHER_BOUNDS,
    DEFAULT_GRAPHER_BOUNDS_SQUARE,
    Grapher,
    GrapherState,
} from "@ourworldindata/grapher"
import { Admin } from "./Admin.js"
import { isChartEditorInstance } from "./ChartEditor.js"
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
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ChartEditorEnvironment } from "./ChartEditorEnvironment.js"
import { ChartEditorSettingsPanel } from "./ChartEditorSettingsPanel.js"

// Re-exported for compatibility: these used to be defined here and are
// imported from this module by EditorBasicTab, VariableSelector, etc.
export { EditorDatabase } from "./ChartEditorEnvironment.js"
export type {
    Dataset,
    Namespace,
    NamespaceData,
    DetailReferences,
} from "./ChartEditorEnvironment.js"

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
    environment: ChartEditorEnvironment<Editor>

    constructor(props: ChartEditorViewProps<Editor>) {
        super(props)

        makeObservable(this, {
            simulateVisionDeficiency: observable,
        })

        this.environment = new ChartEditorEnvironment({
            manager: props.manager,
            onGrapherUpdated: action(() => {
                this.grapherState.externalBounds = this.bounds
            }),
        })
    }

    @computed get grapherState(): GrapherState {
        return this.manager.editor.grapherState
    }

    simulateVisionDeficiency: VisionDeficiency | undefined = undefined

    @computed private get manager(): ChartEditorViewManager<Editor> {
        return this.props.manager
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

    @computed get editor(): Editor | undefined {
        return this.environment.editor
    }

    override componentDidMount(): void {
        this.environment.start()
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
        this.environment.dispose()
        this.editor?.dispose()
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
        const { grapherState } = editor

        const chartEditor = isChartEditorInstance(editor) ? editor : undefined
        const queryParams = chartEditor?.forceDatapage
            ? "?forceDatapage=true"
            : ""

        return (
            <>
                {!editor.isNewGrapher && (
                    <Prompt
                        when={editor.isModified && !chartEditor?.newChartId}
                        message="Are you sure you want to leave? Unsaved changes will be lost."
                    />
                )}
                {chartEditor?.newChartId && (
                    <Redirect to={`/charts/${chartEditor.newChartId}/edit`} />
                )}
                <div className="chart-editor-settings">
                    <ChartEditorSettingsPanel
                        editor={editor}
                        environment={this.environment}
                    />
                </div>
                <div className="chart-editor-view">
                    {grapherState.id && (
                        <a
                            className="preview"
                            href={`/admin/charts/${grapherState.id}/preview${queryParams}`}
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
