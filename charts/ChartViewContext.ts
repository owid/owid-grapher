import { ChartConfig } from "charts/ChartConfig"
import { ChartView } from "charts/ChartView"
import { VNode } from "charts/Util"
import * as React from "react"

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
