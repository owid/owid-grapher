import React from "react"
import { observer } from "mobx-react"
import { Section, Toggle } from "./Forms.js"
import { ChartEditor, isChartEditorInstance } from "./ChartEditor.js"
import { action } from "mobx"
import { mergeGrapherConfigs, partition } from "@ourworldindata/utils"
import {
    Chart,
    IndicatorChartEditor,
    isIndicatorChartEditorInstance,
} from "./IndicatorChartEditor.js"
import { AbstractChartEditor } from "./AbstractChartEditor.js"

@observer
export class EditorInheritanceTab<
    Editor extends AbstractChartEditor,
> extends React.Component<{
    editor: Editor
}> {
    render() {
        const { editor } = this.props
        if (isChartEditorInstance(editor))
            return <EditorInheritanceTabForChart editor={editor} />
        else if (isIndicatorChartEditorInstance(editor))
            return <EditorInheritanceTabForIndicatorChart editor={editor} />
        else return null
    }
}

@observer
class EditorInheritanceTabForChart extends React.Component<{
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
            parentVariableId,
            parentConfig,
            grapher,
            isInheritanceEnabled = false,
        } = this.props.editor

        if (!parentVariableId) return null

        const column = grapher.inputTable.get(parentVariableId.toString())

        const variableLink = (
            <a
                href={`/admin/variables/${parentVariableId}`}
                target="_blank"
                rel="noopener"
            >
                {column?.name ?? parentVariableId}
            </a>
        )

        return (
            <div>
                <Section name="Parent indicator">
                    {isInheritanceEnabled ? (
                        <p>
                            This chart inherits settings from the indicator{" "}
                            {variableLink}. Toggle the option below to disable
                            inheritance.
                        </p>
                    ) : (
                        <p>
                            This chart may inherit chart settings from the
                            indicator {variableLink}. Toggle the option below to
                            enable inheritance and enrich this chart's config by
                            indicator-level chart settings.
                        </p>
                    )}
                    <Toggle
                        label="Inherit settings from indicator"
                        value={isInheritanceEnabled}
                        onValue={this.onToggleInheritance}
                    />
                </Section>

                <Section
                    name={
                        isInheritanceEnabled
                            ? "Parent config"
                            : "Parent config (not currently applied)"
                    }
                >
                    <textarea
                        rows={7}
                        readOnly
                        className="form-control"
                        value={JSON.stringify(parentConfig ?? {}, undefined, 2)}
                    />
                    <p>
                        <a
                            href={`/admin/variables/${parentVariableId}/config`}
                            target="_blank"
                            rel="noopener"
                        >
                            Edit parent config in the admin
                        </a>
                    </p>
                </Section>
            </div>
        )
    }
}

@observer
class EditorInheritanceTabForIndicatorChart extends React.Component<{
    editor: IndicatorChartEditor
}> {
    render() {
        const { charts } = this.props.editor

        const publishedChildren = charts.filter(
            (chart) => chart.isChild && chart.isPublished
        )
        const [chartsInheritanceEnabled, chartsInheritanceDisabled] = partition(
            publishedChildren,
            (chart) => chart.isInheritanceEnabled
        )

        const renderChartList = (charts: Chart[]) => (
            <ul>
                {charts.map((chart) => (
                    <li key={chart.id}>
                        <a
                            href={`/admin/charts/${chart.id}/edit`}
                            target="_blank"
                            rel="noopener"
                        >
                            {chart.title ?? "Missing title"}
                        </a>{" "}
                        <span style={{ color: "#aaa" }}>
                            {chart.variantName && `(${chart.variantName})`}
                        </span>
                    </li>
                ))}
            </ul>
        )

        return (
            <Section name="Inheriting charts">
                <p>
                    Published charts that inherit from this indicator:{" "}
                    {chartsInheritanceEnabled.length === 0 && <i>None</i>}
                </p>

                {chartsInheritanceEnabled.length > 0 &&
                    renderChartList(chartsInheritanceEnabled)}

                <p>
                    Published charts that may inherit from this indicator, but
                    inheritance is currently disabled:{" "}
                    {chartsInheritanceDisabled.length === 0 && <i>None</i>}
                </p>

                {chartsInheritanceDisabled.length > 0 &&
                    renderChartList(chartsInheritanceDisabled)}
            </Section>
        )
    }
}
