import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { LabeledSwitch } from "@ourworldindata/components"

export interface NoDataAreaToggleManager {
    showNoDataArea?: boolean
}

@observer
export class NoDataAreaToggle extends React.Component<{
    manager: NoDataAreaToggleManager
}> {
    @action.bound onToggle(): void {
        this.manager.showNoDataArea = !this.manager.showNoDataArea
    }

    @computed get manager(): NoDataAreaToggleManager {
        return this.props.manager
    }

    render(): React.ReactElement {
        return (
            <LabeledSwitch
                label={"Show \u2018no data\u2019 area"}
                value={this.manager.showNoDataArea}
                tooltip="Include entities for which ‘no data’ is available in the chart."
                onToggle={this.onToggle}
                tracking="chart_no_data_area_toggle"
            />
        )
    }
}
