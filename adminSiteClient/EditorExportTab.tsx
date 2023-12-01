import { action } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { Section, Toggle } from "./Forms.js"

@observer
export class EditorExportTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onToggleShowStaticPreview(value: boolean) {
        this.props.editor.showStaticPreview = value
    }

    render() {
        return (
            <div className="EditorTextTab">
                <Section name="Static mode">
                    <Toggle
                        label="Show static preview"
                        value={this.props.editor.showStaticPreview}
                        onValue={this.onToggleShowStaticPreview}
                    />
                </Section>
            </div>
        )
    }
}
