import * as React from "react"
import { action, makeObservable } from "mobx"
import { observer } from "mobx-react"
import { LabeledSwitch } from "@ourworldindata/components"

export interface ZoomToggleManager {
    zoomToSelection?: boolean
}

@observer
export class ZoomToggle extends React.Component<{
    manager: ZoomToggleManager
}> {
    constructor(props: { manager: ZoomToggleManager }) {
        super(props)
        makeObservable(this)
    }

    @action.bound onToggle(): void {
        this.props.manager.zoomToSelection = this.props.manager.zoomToSelection
            ? undefined
            : true
    }

    render(): React.ReactElement {
        return (
            <LabeledSwitch
                label="Zoom to selection"
                tooltip="Scale axes to focus on the currently highlighted data points."
                value={this.props.manager.zoomToSelection}
                onToggle={this.onToggle}
                tracking="chart_zoom_to_selection"
            />
        )
    }
}
