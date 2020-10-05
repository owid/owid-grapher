import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, ScaleTypeConfig } from "grapher/core/GrapherConstants"
import classNames from "classnames"
import { next } from "grapher/utils/Util"

export interface ScaleSelectorManager extends ScaleTypeConfig {
    x?: number
    y?: number
    maxX?: number // If set, the scale toggle will shift left if it exceeds this number
}

@observer
export class ScaleSelector extends React.Component<{
    manager: ScaleSelectorManager
}> {
    @computed get manager() {
        return this.props.manager
    }

    @computed get inline() {
        return this.manager.x === undefined || this.manager.y === undefined
    }

    @computed get x() {
        return this.manager.x ?? 0
    }
    @computed get y() {
        return this.manager.y ?? 0
    }

    @computed get maxX() {
        return this.manager.maxX || 0
    }

    @computed get scaleTypeOptions() {
        return this.manager.scaleTypeOptions
    }

    @computed get scaleType() {
        return this.manager.scaleType
    }

    @action.bound onClick() {
        this.manager.scaleType = next(this.scaleTypeOptions, this.scaleType)
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
        const { x, y, onClick, scaleType } = this

        const style = {
            left: x - this.getLeftShiftIfNeeded(x),
            top: y,
        }
        return (
            <span
                onClick={onClick}
                style={this.inline ? {} : (style as any)}
                className={classNames([
                    "clickable",
                    "toggleSwitch",
                    { inline: this.inline },
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
