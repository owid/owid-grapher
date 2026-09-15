import * as _ from "lodash-es"
import { Component } from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { excludeUndefined } from "@ourworldindata/utils"
import {
    ErrorMessages,
    ErrorMessagesForDimensions,
} from "./ChartEditorTypes.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { ConfigEditor, isConfigEditorInstance } from "./ConfigEditor.js"
import { notification } from "antd"

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
        if (isConfigEditorInstance(editor))
            return (
                <SaveButtonsForConfig editor={editor} {...passthroughProps} />
            )
        else return null
    }
}

@observer
class SaveButtonsForConfig extends Component<SaveButtonsProps<ConfigEditor>> {
    @action.bound onSave() {
        void this.props.editor.saveGrapher({
            onError: () =>
                notification.error({
                    title: "Saving failed",
                    description:
                        "The host rejected the config; your edits are still here.",
                    placement: "bottomRight",
                }),
        })
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
