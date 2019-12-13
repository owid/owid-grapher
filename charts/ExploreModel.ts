import { observable } from "mobx"
import { ChartType, ChartTypeType } from "./ChartType"
import { ChartConfig } from "./ChartConfig"
import { ExploreUrl } from "./ExploreUrl"

export type ExplorerChartType = ChartTypeType | "WorldMap"

export class ExploreModel {
    static defaultChartType: ExplorerChartType = ChartType.LineChart

    // This is different from the chart's concept of chart type because it includes "WorldMap" as
    // an option, and doesn't include certain chart types we don't support right now, such as
    // scatter plots
    @observable chartType: ExplorerChartType = ExploreModel.defaultChartType

    @observable indicatorId?: number = undefined

    chart: ChartConfig
    url: ExploreUrl

    constructor(chart?: ChartConfig) {
        this.chart = chart || new ChartConfig()
        this.url = new ExploreUrl(this, this.chart.url)
    }

    populateFromQueryStr(queryStr?: string) {
        this.url.populateFromQueryStr(queryStr)
    }
}
