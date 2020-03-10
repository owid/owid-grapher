// TODO make this a string enum in TypeScript 2.4
import { keyBy } from "./Util"

export type ChartTypeType =
    | "LineChart"
    | "ScatterPlot"
    | "TimeScatter"
    | "StackedArea"
    | "DiscreteBar"
    | "SlopeChart"
    | "StackedBar"

export class ChartType {
    static LineChart: ChartTypeType = "LineChart"
    static ScatterPlot: ChartTypeType = "ScatterPlot"
    static TimeScatter: ChartTypeType = "TimeScatter"
    static StackedArea: ChartTypeType = "StackedArea"
    static DiscreteBar: ChartTypeType = "DiscreteBar"
    static SlopeChart: ChartTypeType = "SlopeChart"
    static StackedBar: ChartTypeType = "StackedBar"
}

export const ChartTypeDefs = [
    {
        key: ChartType.LineChart,
        label: "Line Chart"
    },
    {
        key: ChartType.ScatterPlot,
        label: "Scatter Plot"
    },
    {
        key: ChartType.TimeScatter,
        label: "Time Scatter"
    },
    {
        key: ChartType.StackedArea,
        label: "Stacked Area"
    },
    {
        key: ChartType.DiscreteBar,
        label: "Discrete Bar"
    },
    {
        key: ChartType.SlopeChart,
        label: "Slope Chart"
    },
    {
        key: ChartType.StackedBar,
        label: "Stacked Bar"
    }
]

export const ChartTypeDefsByKey = keyBy(ChartTypeDefs, e => e.key)
