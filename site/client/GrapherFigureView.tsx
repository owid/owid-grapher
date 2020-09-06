import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "charts/utils/Bounds"
import { GrapherView } from "charts/core/GrapherView"
import { Grapher } from "charts/core/Grapher"

// Wrapper for GrapherView that uses css on figure element to determine the bounds
@observer
export class GrapherFigureView extends React.Component<{ grapher: Grapher }> {
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
                    <GrapherView
                        grapher={this.props.grapher}
                        bounds={this.bounds}
                    />
                )}
            </figure>
        )
    }
}
