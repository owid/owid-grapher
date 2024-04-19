import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { isEmpty } from "@ourworldindata/utils"

@observer
export class SaveButtons extends React.Component<{ editor: ChartEditor }> {
    @action.bound onSaveChart() {
        void this.props.editor.saveGrapher()
    }

    @action.bound onSaveAsNew() {
        void this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapher.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { editor } = this.props
        const { errorMessages, errorMessagesForDimensions } = editor.manager

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
                </button>{" "}
                <button
                    className="btn btn-danger"
                    onClick={this.onPublishToggle}
                    disabled={isSavingDisabled}
                >
                    {grapher.isPublished ? "Unpublish" : "Publish"}
                </button>
            </div>
        )

        /*return <section className="form-section-submit">
            <button type="button" className="btn btn-lg btn-success btn-primary" onClick={this.onSaveChart}>
                {editor.isSaved ? "Saved" :
                    chart.isPublished ? "Update chart" : "Save draft"}
            </button>
            {" "}<button type="button" className="btn btn-lg btn-primary" onClick={this.onSaveAsNew}>Save as new</button>
            {" "}<button type="button" className="btn btn-lg btn-danger" onClick={this.onPublishToggle}>{chart.isPublished ? "Unpublish" : "Publish"}</button>
        </section>*/
    }
}
