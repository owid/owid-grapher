import * as React from 'react'
import * as ReactDOM from 'react-dom'
import { observable, computed, action } from 'mobx'
import { observer } from 'mobx-react'

import { Bounds } from './Bounds'
import { ChartView } from './ChartView'
import { ChartConfig } from './ChartConfig'

// Wrapper for ChartView that uses css on figure element to determine the bounds
@observer
export class ChartFigureView extends React.Component<{ chart: ChartConfig }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref bounds?: Bounds

    @action.bound calcBounds() {
        this.bounds = Bounds.fromRect(this.base.current!.getBoundingClientRect())
    }

    componentDidMount() {
        window.addEventListener('resize', this.calcBounds)
        this.calcBounds()
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.calcBounds)
    }

    render() {
        return <figure ref={this.base}>
            {this.bounds && <ChartView chart={this.props.chart} bounds={this.bounds}/>}
        </figure>
    }
}