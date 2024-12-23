import * as React from "react"
import { observer } from "mobx-react"
import { computed } from "mobx"
import { Bounds } from "@ourworldindata/utils"
import { GRAPHER_SIDE_PANEL_CLASS } from "../core/GrapherConstants.js"

@observer
export class SidePanel extends React.Component<{
    bounds: Bounds
    children: React.ReactNode
}> {
    @computed private get bounds(): Bounds {
        return this.props.bounds
    }

    render(): React.ReactElement {
        return (
            <div
                className={GRAPHER_SIDE_PANEL_CLASS}
                style={{
                    width: this.bounds.width,
                    height: this.bounds.height,
                }}
            >
                {this.props.children}
            </div>
        )
    }
}
