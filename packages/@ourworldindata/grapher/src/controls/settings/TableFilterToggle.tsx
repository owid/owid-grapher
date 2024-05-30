import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { DEFAULT_GRAPHER_ENTITY_TYPE_PLURAL } from "../../core/GrapherConstants"
import { LabeledSwitch } from "../LabeledSwitch"

export interface TableFilterToggleManager {
    showSelectionOnlyInDataTable?: boolean
    entityTypePlural?: string
}

@observer
export class TableFilterToggle extends React.Component<{
    manager: TableFilterToggleManager
}> {
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
                tooltip={tooltip}
                value={this.props.manager.showSelectionOnlyInDataTable}
                onToggle={this.onToggle}
                tracking="chart_filter_table_rows"
            />
        )
    }
}
