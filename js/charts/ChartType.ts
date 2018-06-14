// TODO make this a string enum in TypeScript 2.4

export type ChartTypeType = "LineChart" | "ScatterPlot" | "StackedArea" | "DiscreteBar" | "SlopeChart" | "StackedBar"

export default class ChartType {
    static LineChart = "LineChart"
    static ScatterPlot = "ScatterPlot"
    static StackedArea = "StackedArea"
    static DiscreteBar = "DiscreteBar"
    static SlopeChart = "SlopeChart"
    static StackedBar = "StackedBar"
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
