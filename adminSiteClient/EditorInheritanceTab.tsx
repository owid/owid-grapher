import React from "react"
import { observer } from "mobx-react"
import { Section, Toggle } from "./Forms.js"
import { ChartEditor } from "./ChartEditor.js"
import { action } from "mobx"
import { mergeGrapherConfigs } from "@ourworldindata/utils"

@observer
export class EditorInheritanceTab extends React.Component<{
    editor: ChartEditor
}> {
    @action.bound onToggleInheritance(newValue: boolean) {
        const { patchConfig, parentConfig } = this.props.editor

        // update live grapher
        const newParentConfig = newValue ? parentConfig : undefined
        const newConfig = mergeGrapherConfigs(
            newParentConfig ?? {},
            patchConfig
        )
        this.props.editor.updateLiveGrapher(newConfig)

        this.props.editor.isInheritanceEnabled = newValue
    }

    render() {
        const {
            parentConfig,
            isInheritanceEnabled = false,
            fullConfig,
            grapher,
        } = this.props.editor

        const parentIndicatorId = parentConfig?.dimensions?.[0].variableId
        const column = parentIndicatorId
            ? grapher.inputTable.get(parentIndicatorId.toString())
            : undefined

        const parentVariableEditLink = (
            <a
                href={`/admin/variables/${parentIndicatorId}`}
                target="_blank"
                rel="noopener"
            >
                {column?.name ?? parentIndicatorId}
            </a>
        )

        return (
            <div className="InheritanceTab">
                <Section name="Parent indicator">
                    {isInheritanceEnabled ? (
                        <p>
                            This chart inherits settings from indicator{" "}
                            {parentVariableEditLink}. Toggle the option below to
                            disable inheritance.
                        </p>
                    ) : (
                        <p>
                            This chart may inherit settings from indicator{" "}
                            {parentVariableEditLink}. Toggle the option below to
                            enable inheritance and enrich this chart's config by
                            indicator-level settings.
                        </p>
                    )}
                    <Toggle
                        label="Inherit settings from indicator"
                        value={isInheritanceEnabled}
                        onValue={this.onToggleInheritance}
                    />
                </Section>
                {isInheritanceEnabled && (
                    <Section name="Inherited Config">
                        <textarea
                            rows={7}
                            readOnly
                            className="form-control"
                            value={JSON.stringify(parentConfig, undefined, 2)}
                        />
                    </Section>
                )}
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
