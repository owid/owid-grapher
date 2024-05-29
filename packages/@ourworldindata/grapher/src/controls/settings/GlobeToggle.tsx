import React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { LabeledSwitch } from "../LabeledSwitch"

export interface GlobeToggleManager {
    isGlobe?: boolean
}

@observer
export class GlobeToggle extends React.Component<{
    manager: GlobeToggleManager
}> {
    private label = "Show globe"

    @action.bound onToggle(): void {
        this.props.manager.isGlobe = !this.props.manager.isGlobe
    }

    render(): React.ReactElement {
        return (
            <LabeledSwitch
                label={this.label}
                value={this.props.manager.isGlobe}
                onToggle={this.onToggle}
                tracking="map_globe"
            />
        )
    }
}
