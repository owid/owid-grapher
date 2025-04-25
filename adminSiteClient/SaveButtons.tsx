import { Component } from "react"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action, computed, observable } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined, omit, slugify } from "@ourworldindata/utils"
import {
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "./ChartEditorTypes.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import {
    ChartViewEditor,
    isChartViewEditorInstance,
} from "./ChartViewEditor.js"
import { NarrativeChartNameModal } from "./NarrativeChartNameModal.js"
import { CreateDataInsightModal } from "./CreateDataInsightModal.js"

@observer
export class SaveButtons<Editor extends AbstractChartEditor> extends Component<{
    editor: Editor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    render() {
        const { editor } = this.props
        const passthroughProps = omit(this.props, "editor")
        if (isChartEditorInstance(editor))
            return <SaveButtonsForChart editor={editor} {...passthroughProps} />
        else if (isIndicatorChartEditorInstance(editor))
            return (
                <SaveButtonsForIndicatorChart
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else if (isChartViewEditorInstance(editor))
            return (
                <SaveButtonsForChartView
                    editor={editor}
                    {...passthroughProps}
                />
            )
        else return null
    }
}

@observer
class SaveButtonsForChart extends Component<{
    editor: ChartEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onSaveAsNew() {
        void this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapherState.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    @computed get initialNarrativeChartName(): string {
        return slugify(this.props.editor.grapherState.title ?? "")
    }

    @observable narrativeChartNameModalOpen:
        | "open"
        | "open-loading"
        | "closed" = "closed"
    @observable narrativeChartNameModalError: string | undefined = undefined

    @action.bound async onSubmitNarrativeChartButton(name: string) {
        const { editor } = this.props

        this.narrativeChartNameModalOpen = "open-loading"
        const res = await editor.saveAsChartView(name)
        if (res.success) {
            this.narrativeChartNameModalOpen = "closed"
        } else {
            this.narrativeChartNameModalOpen = "open"
            this.narrativeChartNameModalError = res.errorMsg
        }
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
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
                            : grapherState.id
                              ? "Save draft"
                              : "Create draft"}
                    </button>{" "}
                    <button
                        className="btn btn-secondary"
                        onClick={this.onSaveAsNew}
                        disabled={isSavingDisabled}
                    >
                        Save as new
                    </button>{" "}
                    <button
                        className="btn btn-danger"
                        onClick={this.onPublishToggle}
                        disabled={isSavingDisabled}
                    >
                        {grapherState.isPublished ? "Unpublish" : "Publish"}
                    </button>
                </div>
                <div className="mt-2">
                    <button
                        className="btn btn-primary"
                        onClick={() => {
                            this.narrativeChartNameModalOpen = "open"
                            this.narrativeChartNameModalError = undefined
                        }}
                        disabled={isSavingDisabled}
                    >
                        Save as narrative chart
                    </button>
                </div>
                <NarrativeChartNameModal
                    open={this.narrativeChartNameModalOpen}
                    initialName={this.initialNarrativeChartName}
                    errorMsg={this.narrativeChartNameModalError}
                    onSubmit={this.onSubmitNarrativeChartButton}
                    onCancel={() =>
                        (this.narrativeChartNameModalOpen = "closed")
                    }
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

@observer
class SaveButtonsForIndicatorChart extends Component<{
    editor: IndicatorChartEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState } = editor

        const isTrivial = editor.isNewGrapher && !editor.isModified
        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled =
            grapherState.hasFatalErrors || hasEditingErrors || isTrivial

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSaveChart}
                    disabled={isSavingDisabled}
                >
                    {editor.isNewGrapher
                        ? "Create indicator chart"
                        : "Update indicator chart"}
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
class SaveButtonsForChartView extends Component<{
    editor: ChartViewEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @observable isCreateDataInsightModalOpen = false

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get editingErrors(): string[] {
        const { errorMessages, errorMessagesForDimensions } = this.props
        return excludeUndefined([
            ...Object.values(errorMessages),
            ...Object.values(errorMessagesForDimensions).flat(),
        ])
    }

    render() {
        const { editingErrors } = this
        const { editor } = this.props
        const { grapherState } = editor

        const hasEditingErrors = editingErrors.length > 0
        const isSavingDisabled = grapherState.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSaveChart}
                    disabled={isSavingDisabled}
                >
                    Save narrative chart
                </button>{" "}
                <a
                    className="btn btn-secondary"
                    href={`/admin/charts/${editor.parentChartId}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    Go to parent chart
                </a>{" "}
                <button
                    className="btn btn-secondary"
                    onClick={() => (this.isCreateDataInsightModalOpen = true)}
                    disabled={isSavingDisabled}
                >
                    Create DI
                </button>
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
                            ...editor.manager.idsAndName!,
                            title: grapherState.currentTitle,
                        }}
                        initialValues={{
                            title: grapherState.currentTitle,
                            imageFilename: editor.manager.idsAndName?.name
                                ? `${editor.manager.idsAndName?.name}.png`
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
