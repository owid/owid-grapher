// todo: remove

import * as React from "react"
import { Grapher } from "grapher/core/Grapher"
import { GrapherView } from "grapher/core/GrapherView"
import { VNode } from "grapher/utils/Util"

export interface GrapherViewContextInterface {
    grapher: Grapher
    grapherView: GrapherView
    baseFontSize: number
    isStatic: boolean
    addPopup: (vnode: VNode) => void
    removePopup: (vnode: VNode) => void
}

export const GrapherViewContext: React.Context<GrapherViewContextInterface> = React.createContext(
    {}
) as any
