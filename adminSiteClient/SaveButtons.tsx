import React from "react"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { isEmpty, omit } from "@ourworldindata/utils"
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

@observer
export class SaveButtons<
    Editor extends AbstractChartEditor,
> extends React.Component<{
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
class SaveButtonsForChart extends React.Component<{
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

    @action.bound onSaveAsNarrativeView() {
        void this.props.editor.saveAsNarrativeView()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapher.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { errorMessages, errorMessagesForDimensions } = this.props

        if (!isEmpty(errorMessages)) return true

        const allErrorMessagesForDimensions = Object.values(
            errorMessagesForDimensions
        ).flat()
        return allErrorMessagesForDimensions.some((error) => error)
    }

    render() {
        const { hasEditingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const isSavingDisabled = grapher.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <div>
                    <button
                        className="btn btn-success"
                        onClick={this.onSaveChart}
                        disabled={isSavingDisabled}
                    >
                        {grapher.isPublished
                            ? "Update chart"
                            : grapher.id
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
                        {grapher.isPublished ? "Unpublish" : "Publish"}
                    </button>
                </div>
                <div className="mt-2">
                    <button
                        className="btn btn-primary"
                        onClick={this.onSaveAsNarrativeView}
                    >
                        Save as narrative view
                    </button>
                </div>
            </div>
        )
    }
}

@observer
class SaveButtonsForIndicatorChart extends React.Component<{
    editor: IndicatorChartEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { errorMessages, errorMessagesForDimensions } = this.props

        if (!isEmpty(errorMessages)) return true

        const allErrorMessagesForDimensions = Object.values(
            errorMessagesForDimensions
        ).flat()
        return allErrorMessagesForDimensions.some((error) => error)
    }

    render() {
        const { hasEditingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const isTrivial = editor.isNewGrapher && !editor.isModified
        const isSavingDisabled =
            grapher.hasFatalErrors || hasEditingErrors || isTrivial

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
            </div>
        )
    }
}

@observer
class SaveButtonsForChartView extends React.Component<{
    editor: ChartViewEditor
    errorMessages: ErrorMessages
    errorMessagesForDimensions: ErrorMessagesForDimensions
}> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { errorMessages, errorMessagesForDimensions } = this.props

        if (!isEmpty(errorMessages)) return true

        const allErrorMessagesForDimensions = Object.values(
            errorMessagesForDimensions
        ).flat()
        return allErrorMessagesForDimensions.some((error) => error)
    }

    render() {
        const { hasEditingErrors } = this
        const { editor } = this.props
        const { grapher } = editor

        const isSavingDisabled = grapher.hasFatalErrors || hasEditingErrors

        return (
            <div className="SaveButtons">
                <button
                    className="btn btn-success"
                    onClick={this.onSaveChart}
                    disabled={isSavingDisabled}
                >
                    Save chart view
                </button>{" "}
                <a
                    className="btn btn-secondary"
                    href={`/admin/charts/${editor.parentChartId}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    Go to parent chart
                </a>
            </div>
        )
    }
}
