// TODO make this a string enum in TypeScript 2.4

type ChartType = "LineChart" | "ScatterPlot" | "StackedArea" | "MultiBar" | "HorizontalMultiBar" | "DiscreteBar" | "SlopeChart"
export default ChartType

export class ChartTypes {
    static LineChart = "LineChart"
    static ScatterPlot = "ScatterPlot"
    static StackedArea = "StackedArea"
    static MultiBar = "MultiBar"
    static HorizontalMultiBar = "HorizontalMultiBar"
    static DiscreteBar = "DiscreteBar"
    static SlopeChart = "SlopeChart"
}