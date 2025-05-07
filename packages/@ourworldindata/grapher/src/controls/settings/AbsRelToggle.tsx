import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { GrapherChartType, StackMode } from "@ourworldindata/types"
import { LabeledSwitch } from "@ourworldindata/components"

export interface AbsRelToggleManager {
    stackMode?: StackMode
    relativeToggleLabel?: string
    activeChartType?: GrapherChartType
}

@observer
export class AbsRelToggle extends React.Component<{
    manager: AbsRelToggleManager
}> {
    @action.bound onToggle(): void {
        this.manager.stackMode = this.isRelativeMode
            ? StackMode.absolute
            : StackMode.relative
    }

    @computed get isRelativeMode(): boolean {
        return this.manager.stackMode === StackMode.relative
    }

    @computed get manager(): AbsRelToggleManager {
        return this.props.manager
    }

    @computed get tooltip(): string {
        const { activeChartType } = this.manager
        return activeChartType === "ScatterPlot"
            ? "Show the percentage change per year over the the selected time range."
            : activeChartType === "LineChart" ||
                activeChartType === "SlopeChart"
              ? "Show proportional changes over time or actual values in their original units."
              : "Show values as their share of the total or as actual values in their original units."
    }

    render(): React.ReactElement {
        const label =
            this.manager.relativeToggleLabel ?? "Display relative values"
        return (
            <LabeledSwitch
                label={label}
                value={this.isRelativeMode}
                tooltip={this.tooltip}
                onToggle={this.onToggle}
                tracking="chart_abs_rel_toggle"
            />
        )
    }
}
