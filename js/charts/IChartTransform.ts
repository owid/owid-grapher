import AxisSpec from './AxisSpec'
import { DataKeyInfo } from './ChartData'
import DataKey from './DataKey'

export default interface IChartTransform {
    isValidConfig: boolean
    yAxis?: AxisSpec
    xAxis?: AxisSpec
    selectableKeys?: string[]
}
