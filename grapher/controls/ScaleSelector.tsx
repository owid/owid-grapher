import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "grapher/core/GrapherConstants"
import classNames from "classnames"
import { next } from "grapher/utils/Util"
import { Bounds } from "grapher/utils/Bounds"

export interface ScaleSelectorManager {
    bounds?: Bounds
    maxX?: number // If set, the scale toggle will shift left if it exceeds this number
    scaleType?: ScaleType
}

@observer
export class ScaleSelector extends React.Component<{
    manager: ScaleSelectorManager
}> {
    @computed get manager() {
        return this.props.manager
    }

    @computed private get isInline() {
        return this.manager.bounds === undefined
    }

    @computed get maxX() {
        return this.manager.maxX || 0
    }

    @computed get scaleType() {
        return this.manager.scaleType ?? ScaleType.linear
    }

    @action.bound onClick() {
        this.manager.scaleType = next(
            [ScaleType.linear, ScaleType.log],
            this.scaleType
        )
    }

    private componentWidth = 95

    private getLeftShiftIfNeeded(xPosition: number) {
        if (!this.maxX) return 0
        const overflow = this.maxX - (xPosition + this.componentWidth)
        let shiftLeft = 0
        if (overflow < 0) shiftLeft = Math.abs(overflow)
        return shiftLeft
    }

    render() {
        if (this.isInline) return this.renderToggle()
        const bounds = this.manager.bounds!
        return (
            <foreignObject
                id="horizontal-scale-selector"
                y={bounds.y - 30}
                x={bounds.x - this.getLeftShiftIfNeeded(bounds.x)}
                width={1}
                height={1}
                style={{ overflow: "visible" }}
            >
                {this.renderToggle()}
            </foreignObject>
        )
    }

    renderToggle() {
        const { scaleType } = this
        return (
            <span
                onClick={this.onClick}
                className={classNames([
                    "clickable",
                    "toggleSwitch",
                    { inline: this.isInline },
                ])}
            >
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "leftToggle " +
                        (scaleType === ScaleType.linear ? "activeToggle" : "")
                    }
                >
                    Linear
                </span>
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "rightToggle " +
                        (scaleType === ScaleType.log ? "activeToggle" : "")
                    }
                >
                    Log
                </span>
            </span>
        )
    }
}
