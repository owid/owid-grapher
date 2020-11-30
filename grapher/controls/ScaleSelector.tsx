import * as React from "react"
import { action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "grapher/core/GrapherConstants"
import classNames from "classnames"
import { next } from "clientUtils/Util"

export interface ScaleSelectorManager {
    scaleType?: ScaleType
}

@observer
export class ScaleSelector extends React.Component<{
    manager?: ScaleSelectorManager
    prefix?: string
}> {
    @action.bound private onClick() {
        const manager = this.props.manager ?? {}
        manager.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            manager.scaleType ?? ScaleType.linear
        )
    }

    render() {
        const { manager, prefix } = this.props
        const { scaleType } = manager ?? {}
        return (
            <span
                onClick={this.onClick}
                className={classNames(["clickable", "toggleSwitch"])}
            >
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "leftToggle " +
                        (scaleType === ScaleType.linear ? "activeToggle" : "")
                    }
                >
                    {prefix}Linear
                </span>
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "rightToggle " +
                        (scaleType === ScaleType.log ? "activeToggle" : "")
                    }
                >
                    {prefix}Log
                </span>
            </span>
        )
    }
}
