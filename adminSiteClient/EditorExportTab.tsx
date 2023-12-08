import { action } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { Section, SelectField } from "./Forms.js"
import { GrapherStaticFormat } from "@ourworldindata/grapher"

@observer
export class EditorExportTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onFormatChange(value: string) {
        this.props.editor.staticPreviewFormat = value as GrapherStaticFormat
    }

    render() {
        const { editor } = this.props

        return (
            <div className="EditorTextTab">
                <Section name="Mobile image size">
                    <SelectField
                        value={editor.staticPreviewFormat}
                        onValue={this.onFormatChange}
                        options={Object.keys(GrapherStaticFormat)
                            .filter(
                                (format) =>
                                    format !== GrapherStaticFormat.landscape
                            )
                            .map((format) => ({
                                value: format,
                                label: format,
                            }))}
                    />
                </Section>
            </div>
        )
    }
}
