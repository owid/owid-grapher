import * as React from "react"
import { ChartConfig } from "charts/core/ChartConfig"
import { ChartView } from "charts/core/ChartView"
import { VNode } from "charts/utils/Util"

export interface ChartViewContextType {
    chart: ChartConfig
    chartView: ChartView
    baseFontSize: number
    isStatic: boolean
    addPopup: (vnode: VNode) => void
    removePopup: (vnode: VNode) => void
}

export const ChartViewContext: React.Context<ChartViewContextType> = React.createContext(
    {}
) as any
