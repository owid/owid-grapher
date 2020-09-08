import * as React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "grapher/utils/Bounds"
import { GrapherView } from "grapher/core/GrapherView"
import { basicGdpGrapher } from "grapher/test/samples"

// Wrapper for GrapherView that uses css on figure element to determine the bounds
@observer
class GrapherViewStory extends React.Component {
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
        const grapher = basicGdpGrapher()

        return (
            <figure
                style={{ height: "600px" }}
                data-grapher-src
                ref={this.base}
            >
                {this.bounds && (
                    <GrapherView grapher={grapher} bounds={this.bounds} />
                )}
            </figure>
        )
    }
}

export default {
    title: "GrapherView",
    component: GrapherView,
}

export const Default = () => <GrapherViewStory />
