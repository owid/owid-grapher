/* StandardAxisBoxView.tsx
 * ================
 *
 * Default axis UI given a box and chart state.
 */

import * as React from "react"
import { AxisBox, AxisBoxView } from "./AxisBox"
import { ChartConfig } from "./ChartConfig"
import { ScaleType } from "./ScaleType"
import { action } from "mobx"

export interface StandardAxisBoxViewProps {
    axisBox: AxisBox
    chart: ChartConfig
}

export class StandardAxisBoxView extends React.Component<
    StandardAxisBoxViewProps
> {
    @action.bound onXScaleChange(scaleType: ScaleType) {
        this.props.chart.xAxis.scaleType = scaleType
    }

    @action.bound onYScaleChange(scaleType: ScaleType) {
        this.props.chart.yAxis.scaleType = scaleType
    }

    render() {
        const { axisBox } = this.props
        return (
            <AxisBoxView
                chart={this.props.chart}
                axisBox={axisBox}
                onXScaleChange={this.onXScaleChange}
                onYScaleChange={this.onYScaleChange}
                showTickMarks={true}
            />
        )
    }
}
