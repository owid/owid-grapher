import React from "react"
import { observer } from "mobx-react"
import { Section } from "./Forms.js"
import { partition } from "@ourworldindata/utils"
import { Chart, IndicatorChartEditor } from "./IndicatorChartEditor.js"

@observer
export class EditorInheritanceTab extends React.Component<{
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
