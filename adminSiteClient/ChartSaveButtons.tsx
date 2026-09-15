/**
 * The admin's save actions for a chart row: save/create, save as new,
 * publish/unpublish, delete, save as narrative chart. Plugged into the
 * config-only editor through `GrapherEditor`'s `renderSaveButtons`; the
 * actions themselves live on the page that owns the chart record.
 */
import { Component } from "react"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { slugify } from "@ourworldindata/utils"
import { ConfigEditor } from "./ConfigEditor.js"
import { NarrativeChartNameModal } from "./NarrativeChartNameModal.js"

export interface ChartSaveActions {
    saveAsNew: () => Promise<void>
    togglePublished: () => void
    delete: () => Promise<void>
    saveAsNarrativeChart: (
        name: string
    ) => Promise<{ success: boolean; errorMsg?: string }>
}

interface ChartSaveButtonsProps {
    editor: ConfigEditor
    editingErrors: string[]
    /** Whether the chart has been created yet. */
    isNewChart: boolean
    actions: ChartSaveActions
}

@observer
export class ChartSaveButtons extends Component<ChartSaveButtonsProps> {
    constructor(props: ChartSaveButtonsProps) {
        super(props)

        makeObservable(this, {
            isNarrativeChartNameModalOpen: observable,
            narrativeChartNameModalError: observable,
        })
    }

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get initialNarrativeChartName(): string {
        return slugify(this.props.editor.grapherState.title ?? "")
    }

    isNarrativeChartNameModalOpen = false
    narrativeChartNameModalError: string | undefined = undefined

    @action.bound async onSubmitNarrativeChartButton(name: string) {
        const res = await this.props.actions.saveAsNarrativeChart(name)
        if (res.success) {
            this.isNarrativeChartNameModalOpen = false
        } else {
            this.narrativeChartNameModalError = res.errorMsg
        }
    }

    override render() {
        const { editor, editingErrors, isNewChart, actions } = this.props
        const { grapherState } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapherState.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <div>
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        {grapherState.isPublished
                            ? "Update chart"
                            : isNewChart
                              ? "Create draft"
                              : "Save draft"}
                    </button>{" "}
                    {!isNewChart && (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    void actions.saveAsNew()
                                }}
                                disabled={isSavingDisabled}
                            >
                                Save as new
                            </button>{" "}
                            <button
                                className="btn btn-danger"
                                onClick={actions.togglePublished}
                                disabled={isSavingDisabled}
                            >
                                {grapherState.isPublished
                                    ? "Unpublish"
                                    : "Publish"}
                            </button>{" "}
                            <button
                                className="btn btn-danger"
                                onClick={() => {
                                    void actions.delete()
                                }}
                            >
                                Delete
                            </button>
                        </>
                    )}
                </div>
                {!isNewChart && (
                    <div className="mt-2">
                        <button
                            className="btn btn-primary"
                            onClick={action(() => {
                                this.isNarrativeChartNameModalOpen = true
                                this.narrativeChartNameModalError = undefined
                            })}
                            disabled={isSavingDisabled}
                        >
                            Save as narrative chart
                        </button>
                    </div>
                )}
                <NarrativeChartNameModal
                    isOpen={this.isNarrativeChartNameModalOpen}
                    initialName={this.initialNarrativeChartName}
                    errorMsg={this.narrativeChartNameModalError}
                    onSubmit={this.onSubmitNarrativeChartButton}
                    onCancel={action(
                        () => (this.isNarrativeChartNameModalOpen = false)
                    )}
                />
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <div key={i} className="alert alert-danger mt-2">
                            {error}
                        </div>
                    ))}
            </div>
        )
    }
}
