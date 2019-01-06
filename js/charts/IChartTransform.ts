import { AxisSpec } from './AxisSpec'

export interface IChartTransform {
    isValidConfig: boolean
    yAxis?: AxisSpec
    xAxis?: AxisSpec
    selectableKeys?: string[]
}
