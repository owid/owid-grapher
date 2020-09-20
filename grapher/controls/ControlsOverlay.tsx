// todo: remove

import { observer } from "mobx-react"
import React from "react"
import { action } from "mobx"
import { Grapher } from "grapher/core/Grapher"
import { VNode } from "grapher/utils/Util"

export interface GrapherContextInterface {
    grapher: Grapher
    isStatic: boolean
    addPopup: (vnode: VNode) => void
    removePopup: (vnode: VNode) => void
}

export const GrapherContext: React.Context<GrapherContextInterface> = React.createContext(
    {}
) as any

@observer
export class ControlsOverlay extends React.Component<{
    id: string
    children: JSX.Element
    paddingTop?: number
    paddingRight?: number
    paddingBottom?: number
    paddingLeft?: number
}> {
    static contextType = GrapherContext
    context!: GrapherContextInterface

    componentDidMount() {
        // todo: remove context
        if (this.context?.grapher)
            this.context.grapher.overlays[this.props.id] = this
    }

    @action.bound private deleteOverlay() {
        // todo: remove context
        delete this.context?.grapher?.overlays[this.props.id]
    }

    componentWillUnmount() {
        this.deleteOverlay()
    }

    render() {
        return null
    }
}
