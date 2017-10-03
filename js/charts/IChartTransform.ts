import AxisSpec from './AxisSpec'

export default interface IChartTransform {
    isValidConfig: boolean
    yAxis?: AxisSpec
    xAxis?: AxisSpec
}
