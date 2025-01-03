import * as React from "react"
import {
    ALL_GRAPHER_CHART_TYPES,
    GrapherChartType,
} from "@ourworldindata/types"

// Just a utility for testing
export class ChartTypeSwitcher extends React.Component<{
    onChange: (chartType: GrapherChartType) => void
}> {
    render(): React.ReactElement {
        return (
            <select
                onChange={(event): void =>
                    this.props.onChange(event.target.value as any)
                }
            >
                {ALL_GRAPHER_CHART_TYPES.map((value) => (
                    <option key={value} value={value}>
                        {value}
                    </option>
                ))}
            </select>
        )
    }
}
