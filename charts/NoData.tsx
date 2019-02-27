import * as React from 'react'
import { Bounds } from './Bounds'
import { TextWrap } from './TextWrap'
import { ChartConfig } from './ChartConfig'
import {observer} from 'mobx-react'
import { ChartViewContext, ChartViewContextType } from './ChartViewContext'

@observer
export class NoData extends React.Component<{ bounds: Bounds, message?: string }> {
    static contextType = ChartViewContext
    context!: ChartViewContextType

    render() {
        const { bounds, message } = this.props
        const msgWrap = new TextWrap({ fontSize: this.context.chart.baseFontSize, maxWidth: bounds.width, text: message || "No available data" })
        return <g className="NoData">
            {msgWrap.render(bounds.x + bounds.width / 2 - msgWrap.width / 2, bounds.y + bounds.height / 2 - msgWrap.height / 2, { fill: "#444" })}
        </g>
    }
}
