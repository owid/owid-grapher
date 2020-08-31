// todo: remove

import * as React from "react"
import { ChartRuntime } from "charts/core/ChartRuntime"
import { ChartView } from "charts/core/ChartView"
import { VNode } from "charts/utils/Util"

export interface ChartViewContextType {
    chart: ChartRuntime
    chartView: ChartView
    baseFontSize: number
    isStatic: boolean
    addPopup: (vnode: VNode) => void
    removePopup: (vnode: VNode) => void
}

export const ChartViewContext: React.Context<ChartViewContextType> = React.createContext(
    {}
) as any
