import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "charts/utils/Bounds"
import { ChartView } from "charts/core/ChartView"
import { ChartRuntime } from "charts/core/ChartRuntime"

// Wrapper for ChartView that uses css on figure element to determine the bounds
@observer
export class ChartFigureView extends React.Component<{ chart: ChartRuntime }> {
    base: React.RefObject<HTMLDivElement> = React.createRef()
    @observable.ref bounds?: Bounds

    @action.bound calcBounds() {
        this.bounds = Bounds.fromRect(
            this.base.current!.getBoundingClientRect()
        )
    }

    componentDidMount() {
        window.addEventListener("resize", this.calcBounds)
        this.calcBounds()
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this.calcBounds)
    }

    render() {
        return (
            <figure data-grapher-src ref={this.base}>
                {this.bounds && (
                    <ChartView chart={this.props.chart} bounds={this.bounds} />
                )}
            </figure>
        )
    }
}
