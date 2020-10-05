import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType, ScaleTypeConfig } from "grapher/core/GrapherConstants"
import classNames from "classnames"

interface ScaleSelectorOptions {
    x?: number
    y?: number
    maxX?: number // If set, the scale toggle will shift left if it exceeds this number
    scaleTypeConfig: ScaleTypeConfig
    inline?: boolean
}

@observer
export class ScaleSelector extends React.Component<ScaleSelectorOptions> {
    @computed get x() {
        return this.props.x ?? 0
    }
    @computed get y() {
        return this.props.y ?? 0
    }

    @computed get maxX() {
        return this.props.maxX || 0
    }

    @computed get scaleTypeOptions() {
        return this.props.scaleTypeConfig.scaleTypeOptions
    }

    @computed get scaleType() {
        return this.props.scaleTypeConfig.scaleType
    }

    @action.bound onClick() {
        const { scaleType, scaleTypeOptions } = this

        let nextScaleTypeIndex = scaleTypeOptions.indexOf(scaleType) + 1
        if (nextScaleTypeIndex >= scaleTypeOptions.length)
            nextScaleTypeIndex = 0

        const newValue = scaleTypeOptions[nextScaleTypeIndex]

        if (this.props.scaleTypeConfig.updateChartScaleType)
            this.props.scaleTypeConfig.updateChartScaleType(newValue)
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
                style={this.props.inline ? {} : (style as any)}
                className={classNames([
                    "clickable",
                    "toggleSwitch",
                    { inline: this.props.inline },
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
