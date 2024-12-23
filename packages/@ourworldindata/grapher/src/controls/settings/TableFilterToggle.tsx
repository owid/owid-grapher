import * as React from "react"
import { action, computed } from "mobx"
import { observer } from "mobx-react"
import { DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL } from "../../core/GrapherConstants"
import { LabeledSwitch } from "@ourworldindata/components"
import { Bounds } from "@ourworldindata/utils"

export interface TableFilterToggleManager {
    showSelectionOnlyInDataTable?: boolean
    entityTypePlural?: string
}

@observer
export class TableFilterToggle extends React.Component<{
    manager: TableFilterToggleManager
    showTooltip?: boolean
}> {
    static width(manager: TableFilterToggleManager): number {
        return new TableFilterToggle({ manager }).width
    }

    private label = "Show selection only"

    // keep in sync with CSS
    @computed get width(): number {
        const toggleWidth = 30
        const infoIconWidth = 22
        const labelWidth = Bounds.forText(this.label, { fontSize: 13 }).width
        return labelWidth + toggleWidth + infoIconWidth + 4
    }

    @action.bound onToggle(): void {
        const { manager } = this.props
        manager.showSelectionOnlyInDataTable =
            manager.showSelectionOnlyInDataTable ? undefined : true
    }

    render(): React.ReactElement {
        const tooltip = `Only display table rows for ${
            this.props.manager.entityTypePlural ??
            DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL
        } selected within the chart`

        return (
            <LabeledSwitch
                label="Show selection only"
                tooltip={this.props.showTooltip ? tooltip : undefined}
                value={this.props.manager.showSelectionOnlyInDataTable}
                onToggle={this.onToggle}
                tracking="chart_filter_table_rows"
            />
        )
    }
}
