import * as _ from "lodash-es"
import { Component } from "react"
import { action, computed, observable, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "./ChartEditorTypes.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    NarrativeChartEditor,
    isNarrativeChartEditorInstance,
} from "./NarrativeChartEditor.js"
import { ConfigEditor, isConfigEditorInstance } from "./ConfigEditor.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"

interface SaveButtonsProps<Editor extends AbstractChartEditor> {
    editor: Editor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}

@observer
export class SaveButtons<Editor extends AbstractChartEditor> extends Component<
    SaveButtonsProps<Editor>
> {
    override render() {
        const { editor } = this.props
        const passthroughProps = _.omit(this.props, "editor")
        if (isNarrativeChartEditorInstance(editor))
            return (
                <SaveButtonsForNarrativeChart
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else if (isConfigEditorInstance(editor))
            return (
                <SaveButtonsForConfig editor={editor} {...passthroughProps} />
            )
        else return null
    }
}

@observer
class SaveButtonsForConfig extends Component<SaveButtonsProps<ConfigEditor>> {
    @action.bound onSave() {
        void this.props.editor.saveGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    override render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState } = editor
        const isSavingDisabled =
            grapherState.hasFatalErrors || editingErrors.length > 0

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSave}
                    disabled={isSavingDisabled || !editor.isModified}
                >
                    Save config
                </button>
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

@observer
class SaveButtonsForNarrativeChart extends Component<
    SaveButtonsProps<NarrativeChartEditor>
> {
    isCreateDataInsightModalOpen = false

    constructor(props: SaveButtonsProps<NarrativeChartEditor>) {
        super(props)

        makeObservable(this, {
            isCreateDataInsightModalOpen: observable,
        })
    }

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onCreateChart() {
        void this.props.editor.createGrapher()
    }

    @action.bound async onCreateDataInsight() {
        const { editor } = this.props
        // Save the narrative chart first if there are unsaved changes
        if (editor.isModified) {
            const shouldSave = window.confirm(
                "You have unsaved changes to this narrative chart. The Data Insight will use the saved version. Do you want to save your changes now before creating the DI?"
            )
            if (!shouldSave) return
            await editor.saveGrapher()
        }
        this.isCreateDataInsightModalOpen = true
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    override render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState, isNewGrapher } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapherState.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                {isNewGrapher ? (
                    <button
                        className="btn btn-success"
                        onClick={this.onCreateChart}
                        disabled={isSavingDisabled}
                    >
                        Create narrative chart
                    </button>
                ) : (
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        Save narrative chart
                    </button>
                )}{" "}
                {editor.parentUrl && (
                    <>
                        <a
                            className="btn btn-secondary"
                            href={`/admin${editor.parentUrl}`}
                            target="_blank"
                            rel="noopener"
                        >
                            Go to parent chart
                        </a>{" "}
                    </>
                )}
                {!editor.isNewGrapher && (
                    <button
                        className="btn btn-secondary"
                        onClick={this.onCreateDataInsight}
                        disabled={isSavingDisabled}
                    >
                        Create DI
                    </button>
                )}
                {grapherState.isReady &&
                    editingErrors.map((error, i) => (
                        <div key={i} className="alert alert-danger mt-2">
                            {error}
                        </div>
                    ))}
                {this.isCreateDataInsightModalOpen && (
                    <CreateDataInsightModal
                        description="Create a new data insight based on this narrative chart."
                        narrativeChart={{
                            name: editor.manager.name!,
                            configId: editor.manager.configId!,
                            title: grapherState.fullTitle,
                        }}
                        initialValues={{
                            title: grapherState.fullTitle,
                            imageFilename: editor.manager.name
                                ? `${editor.manager.name}.png`
                                : undefined,
                        }}
                        hiddenFields={["grapherUrl", "narrativeChart"]}
                        closeModal={() =>
                            (this.isCreateDataInsightModalOpen = false)
                        }
                        onFinish={(response) => {
                            if (response.success) {
                                this.isCreateDataInsightModalOpen = false
                                window.open(
                                    `/admin/gdocs/${response.gdocId}/preview`,
                                    "_blank"
                                )
                            }
                        }}
                    />
                )}
            </div>
        )
    }
}
