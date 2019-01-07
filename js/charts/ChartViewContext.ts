import * as React from 'react'
import { ChartConfig } from '../charts/ChartConfig'
import { ChartView } from '../charts/ChartView'
import { VNode } from '../charts/Util'

const ChartViewContext: React.Context<{
    chart: ChartConfig
    chartView: ChartView
    baseFontSize: number
    isStatic: boolean
    addPopup: (vnode: VNode) => void,
    removePopup: (vnode: VNode) => void
}> = React.createContext({}) as any
export { ChartViewContext }
