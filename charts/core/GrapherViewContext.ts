// todo: remove

import * as React from "react"
import { Grapher } from "charts/core/Grapher"
import { GrapherView } from "charts/core/GrapherView"
import { VNode } from "charts/utils/Util"

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
