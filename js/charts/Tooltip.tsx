import * as _ from 'lodash'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import ChartView from './ChartView'
import {observable, computed} from 'mobx'
import {observer} from 'mobx-react'
import Bounds from './Bounds'

export interface TooltipDatum {
    entity: string,
    year: number,
    value: number|string
}

export interface TooltipProps {
    x: number,
    y: number,
    isFixed?: boolean
}

@observer
class TooltipView extends React.Component<TooltipProps> {
    context: { chartView: ChartView }

    @computed get rendered() {
        const {props, bounds} = this
        const {isFixed} = props
        const {chartView} = this.context
        
        let x = props.x*(isFixed ? 1 : chartView.scale)
        let y = props.y*(isFixed ? 1 : chartView.scale)

        if (bounds) {
            if (x+bounds.width > chartView.containerBounds.right)
                x -= bounds.width
            if (y+bounds.height > chartView.containerBounds.bottom)
                y -= bounds.height
        }

        return <div className="nvtooltip tooltip-xy owid-tooltip" style={{ position: isFixed ? 'fixed' : 'absolute', left: x+'px', top: y+'px' }}>
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