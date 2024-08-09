import React from "react"
import { observer } from "mobx-react"
import { AbstractChartEditor } from "./AbstractChartEditor.js"
import { Section } from "./Forms.js"

@observer
export class EditorInheritanceTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{ editor: Editor }> {
    render() {
        const { parentConfig, fullConfig, grapher } = this.props.editor

        if (!parentConfig)
            return (
                <div className="InheritanceTab">
                    Doesn't inherit settings from any indicator
                </div>
            )

        const parentIndicatorId = parentConfig.dimensions?.[0].variableId

        if (!parentIndicatorId)
            return (
                <div className="InheritanceTab">
                    Does inherit settings from any indicator but can't find the
                    indicator's id (shouldn't happen, please report this bug!)
                </div>
            )

        const column = grapher.inputTable.get(parentIndicatorId.toString())

        return (
            <div className="InheritanceTab">
                <Section name="Parent indicator">
                    Inherits settings from indicator{" "}
                    <a
                        href={`/admin/variables/${parentIndicatorId}`}
                        target="_blank"
                        rel="noopener"
                    >
                        {column.name}.
                    </a>
                </Section>
                <Section name="Inherited Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(parentConfig, undefined, 2)}
                    />
                </Section>
                <Section name="Full Config">
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(fullConfig, undefined, 2)}
                    />
                </Section>
            </div>
        )
    }
}
