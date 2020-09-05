// todo: remove

import * as React from "react"
import { Grapher } from "charts/core/Grapher"
import { ChartView } from "charts/chart/ChartView"
import { VNode } from "charts/utils/Util"

export interface ChartViewContextType {
    chart: Grapher
    chartView: ChartView
    baseFontSize: number
    isStatic: boolean
    addPopup: (vnode: VNode) => void
    removePopup: (vnode: VNode) => void
}

export const ChartViewContext: React.Context<ChartViewContextType> = React.createContext(
    {}
) as any
