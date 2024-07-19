import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { isEmpty } from "@ourworldindata/utils"
import { ChartEditorContext } from "./ChartEditorContext.js"
import { IndicatorChartEditor } from "./IndicatorChartEditor.js"

@observer
export class SaveButtonsForChart extends React.Component<{
    editor: ChartEditor
}> {
    // TODO
    static contextType = ChartEditorContext

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    // TODO

    @action.bound onSaveAsNew() {
        void this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapher.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { errorMessages, errorMessagesForDimensions } = this.context

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
                </button>
                <button
                    className="btn btn-danger"
                    onClick={this.onPublishToggle}
                    disabled={isSavingDisabled}
                >
                    {grapher.isPublished ? "Unpublish" : "Publish"}
                </button>
            </div>
        )
    }
}

@observer
export class SaveButtonsForIndicatorChart extends React.Component<{
    editor: IndicatorChartEditor
}> {
    static contextType = ChartEditorContext

    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { errorMessages, errorMessagesForDimensions } = this.context

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
                    {editor.isNewGrapher ? "Create chart" : "Save chart"}
                </button>
            </div>
        )
    }
}
