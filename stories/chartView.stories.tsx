import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "charts/Bounds"
import { ChartView } from "charts/ChartView"
import { ChartConfig } from "charts/ChartConfig"
import { chartViewData } from "./chartView.data"

// Wrapper for ChartView that uses css on figure element to determine the bounds
@observer
class ChartStoryView extends React.Component {
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
        const chart = new ChartConfig(undefined, {})
        chart.receiveData(chartViewData as any)

        return (
            <figure
                style={{ height: "600px" }}
                data-grapher-src
                ref={this.base}
            >
                {this.bounds && (
                    <ChartView chart={chart} bounds={this.bounds} />
                )}
            </figure>
        )
    }
}

export default {
    title: "ChartView"
}

export const Default = () => <ChartStoryView />
