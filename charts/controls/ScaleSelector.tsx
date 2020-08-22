/* ScaleSelector.jsx
 * ================
 *
 * Small toggle component for switching between log/linear (or any other) scale types.
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import * as React from "react"
import { computed, action } from "mobx"
import { observer } from "mobx-react"
import { ScaleType } from "../ChartConstants"
import { ChartViewContext, ChartViewContextType } from "../ChartViewContext"

interface ScaleSelectorProps {
    x: number
    y: number
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    onChange: (scaleType: ScaleType) => void
}

@observer
export class ScaleSelector extends React.Component<ScaleSelectorProps> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    @computed get x(): number {
        return this.props.x
    }
    @computed get y(): number {
        return this.props.y
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        return this.props.scaleTypeOptions
    }

    @computed get scaleType(): ScaleType {
        return this.props.scaleType
    }

    @action.bound onClick() {
        const { scaleType, scaleTypeOptions } = this

        let nextScaleTypeIndex = scaleTypeOptions.indexOf(scaleType) + 1
        if (nextScaleTypeIndex >= scaleTypeOptions.length)
            nextScaleTypeIndex = 0

        this.props.onChange(scaleTypeOptions[nextScaleTypeIndex])
    }

    private componentWidth = 95

    private getLeftShiftIfNeeded(xPosition: number) {
        const maxWidth = this.context.chartView.tabBounds.width
        const overflow = maxWidth - (xPosition + this.componentWidth)
        let shiftLeft = 0
        if (overflow < 0) shiftLeft = Math.abs(overflow)
        return shiftLeft
    }

    render() {
        const { x, y, onClick, scaleType } = this

        if (this.context.isStatic) return null

        const style = {
            left: x - this.getLeftShiftIfNeeded(x),
            top: y
        }
        return (
            <div
                onClick={onClick}
                style={style as any}
                className="clickable toggleSwitch"
            >
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "leftToggle " +
                        (scaleType === "linear" ? "activeToggle" : "")
                    }
                >
                    Linear
                </span>
                <span
                    data-track-note="chart-toggle-scale"
                    className={
                        "rightToggle " +
                        (scaleType === "log" ? "activeToggle" : "")
                    }
                >
                    Log
                </span>
            </div>
        )
    }
}
