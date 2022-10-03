import React from "react"
import { ChartTypeName } from "../core/GrapherConstants.js"

// Just a utility for testing
export class ChartTypeSwitcher extends React.Component<{
    onChange: (chartType: ChartTypeName) => void
}> {
    render(): JSX.Element {
        return (
            <select
                onChange={(event): void =>
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
