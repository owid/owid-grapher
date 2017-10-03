import { extend } from './Util'
import * as React from 'react'
import ChartView from './ChartView'
import { observable, computed } from 'mobx'
import { observer } from 'mobx-react'
import Bounds from './Bounds'

export interface TooltipProps {
    x: number
    y: number,
    style?: React.CSSProperties
}

@observer
class TooltipView extends React.Component<TooltipProps> {
    context: { chartView: ChartView }

    @computed get rendered() {
        const { props, bounds } = this
        const { chartView } = this.context

        let x = props.x
        let y = props.y

        // Ensure tooltip remains inside chart
        if (bounds) {
            if (x + bounds.width > chartView.renderWidth)
                x -= bounds.width
            if (y + bounds.height > chartView.renderHeight)
                y -= bounds.height
            if (x < 0)
                x = 0
            if (y < 0)
                y = 0
        }

        const style = { position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none', left: `${x}px`, top: `${y}px`, backgroundColor: "white", border: "1px solid #ccc", textAlign: 'left', fontSize: "0.9em", zIndex: 100 }

        return <div style={extend(style, props.style || {})}>
            {props.children}
        </div>
    }

    base: HTMLDivElement
    @observable.struct bounds?: Bounds
    componentDidMount() {
        this.componentDidUpdate()
    }
    componentDidUpdate() {
        this.bounds = Bounds.fromElement(this.base)
    }

    render() {
        return this.rendered
    }
}

@observer
export default class Tooltip extends React.Component<TooltipProps> {
    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        this.context.chartView.chart.tooltip = <TooltipView {...this.props}>{this.props.children}</TooltipView>
    }

    componentWillUnmount() {
        this.context.chartView.chart.tooltip = null
    }
}
