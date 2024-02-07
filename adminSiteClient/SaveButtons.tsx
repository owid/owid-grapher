import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { action, computed } from "mobx"
import { observer } from "mobx-react"

@observer
export class SaveButtons extends React.Component<{ editor: ChartEditor }> {
    @action.bound onSaveChart() {
        this.props.editor.saveGrapher()
    }

    @action.bound onSaveAsNew() {
        this.props.editor.saveAsNewGrapher()
    }

    @action.bound onPublishToggle() {
        if (this.props.editor.grapher.isPublished)
            this.props.editor.unpublishGrapher()
        else this.props.editor.publishGrapher()
    }

    @computed get hasEditingErrors(): boolean {
        const { editor } = this.props
        const { errorMessages, errorMessagesForDimensions } = editor.manager

        for (const message of Object.values(errorMessages)) {
            if (message) return true
        }

        for (const slot of Object.values(errorMessagesForDimensions)) {
            for (const dimension of slot) {
                if (!dimension) continue
                const messages = Object.values(dimension).filter(
                    (message) => message
                )
                if (messages.length > 0) return true
            }
        }

        return false
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
