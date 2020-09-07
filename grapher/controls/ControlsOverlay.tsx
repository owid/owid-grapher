import { observer } from "mobx-react"
import React from "react"
import {
    GrapherViewContext,
    GrapherViewContextInterface,
} from "grapher/core/GrapherViewContext"
import { action } from "mobx"

@observer
export class ControlsOverlay extends React.Component<{
    id: string
    children: JSX.Element
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
}> {
    static contextType = GrapherViewContext
    context!: GrapherViewContextInterface

    componentDidMount() {
        // todo: remove context
        if (this.context?.grapherView)
            this.context.grapherView.overlays[this.props.id] = this
    }

    @action.bound deleteOverlay() {
        // todo: remove context
        delete this.context?.grapherView?.overlays[this.props.id]
    }

    componentWillUnmount() {
        this.deleteOverlay()
    }

    render() {
        return null
    }
}
