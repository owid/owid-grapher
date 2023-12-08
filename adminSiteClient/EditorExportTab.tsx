import { action } from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { ChartEditor } from "./ChartEditor.js"
import { Section, SelectField } from "./Forms.js"
import { GrapherStaticFormat } from "@ourworldindata/grapher"

const FORMAT_LABELS: Record<GrapherStaticFormat, string> = {
    [GrapherStaticFormat.portrait]: "Data insight",
    [GrapherStaticFormat.instagram]: "Instagram",
    [GrapherStaticFormat.landscape]: "Landscape",
}

@observer
export class EditorExportTab extends React.Component<{ editor: ChartEditor }> {
    @action.bound onPresetChange(value: string) {
        this.props.editor.staticPreviewFormat = value as GrapherStaticFormat
    }

    render() {
        const { editor } = this.props

        return (
            <div className="EditorTextTab">
                <Section name="Mobile image size">
                    <SelectField
                        label="Preset"
                        value={editor.staticPreviewFormat}
                        onValue={this.onPresetChange}
                        options={Object.keys(GrapherStaticFormat)
                            .filter(
                                (format) =>
                                    format !== GrapherStaticFormat.landscape
                            )
                            .map((format) => ({
                                value: format,
                                label: FORMAT_LABELS[
                                    format as GrapherStaticFormat
                                ],
                            }))}
                    />
                </Section>
            </div>
        )
    }
}
