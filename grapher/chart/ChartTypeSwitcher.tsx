import React from "react"
import { ChartTypeName } from "grapher/core/GrapherConstants"

// Just a utility for testing
export class ChartTypeSwitcher extends React.Component<{
    onChange: (chartType: ChartTypeName) => void
}> {
    render() {
        return (
            <select
                onChange={(event) =>
                    this.props.onChange(event.target.value as any)
                }
            >
                {Object.values(ChartTypeName).map((value) => (
                    <option key={value} value={value}>
                        {value}
                    </option>
                ))}
            </select>
        )
    }
}
