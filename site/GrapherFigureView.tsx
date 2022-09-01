import React from "react"
import { observable, action } from "mobx"
import { observer } from "mobx-react"

import { Bounds } from "../clientUtils/Bounds.js"
import { Grapher } from "../grapher/core/Grapher.js"

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
            dataApiUrlForAdmin:
                this.context?.admin?.settings?.DATA_API_FOR_ADMIN_UI, // passed this way because clientSettings are baked and need a recompile to be updated
        }
        return (
            // They key= in here makes it so that the chart is re-loaded when the slug changes.
            // This is especially important for SearchResults, where the preview chart can change as
            // the search query changes.
            <figure data-grapher-src ref={this.base}>
                {this.bounds && <Grapher key={props.slug} {...props} />}
            </figure>
        )
    }
}
