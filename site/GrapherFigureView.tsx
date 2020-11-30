import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "clientUtils/Bounds"
import { Grapher } from "grapher/core/Grapher"

// Wrapper for Grapher that uses css on figure element to determine the bounds
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
        const props = {
            ...this.props.grapher.toObject(),
            bounds: this.bounds,
        }
        return (
            <figure data-grapher-src ref={this.base}>
                {this.bounds && <Grapher {...props} />}
            </figure>
        )
    }
}
