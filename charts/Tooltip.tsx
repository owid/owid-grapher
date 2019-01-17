import { extend } from './Util'
import * as React from 'react'
import { ChartViewContext } from './ChartViewContext'
import { observable, computed, runInAction } from 'mobx'
import { observer } from 'mobx-react'
import { Bounds } from './Bounds'

export interface TooltipProps {
    x: number
    y: number,
    style?: React.CSSProperties
}

@observer
export class TooltipView extends React.Component {
    static contextType = ChartViewContext

    @computed get rendered() {
        const { bounds } = this
        const { chartView, chart } = this.context

        if (!chart.tooltip) return null

        const tooltip  = chart.tooltip

        let x = tooltip.x as number
        let y = tooltip.y as number

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

        return <div ref={this.base} style={extend(style, tooltip.style || {})}>
            {tooltip.children}
        </div>
    }

    base: React.RefObject<HTMLDivElement> = React.createRef()

    @observable.struct bounds?: Bounds
    componentDidMount() {
        this.componentDidUpdate()
    }
    componentDidUpdate() {
        runInAction(() => {
            if (this.base.current)
                this.bounds = Bounds.fromElement(this.base.current)
        })
    }

    render() {
        return this.rendered
    }
}

@observer
export class Tooltip extends React.Component<TooltipProps> {
    static contextType = ChartViewContext

    componentDidMount() {
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        runInAction(() => this.context.chart.tooltip = this.props)
    }

    componentWillUnmount() {
        runInAction(() => this.context.chart.tooltip = null)
    }

    render() {
        return null
    }
}
