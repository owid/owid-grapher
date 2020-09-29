import { observable, computed, autorun, IReactionDisposer, action } from "mobx"
import {
    ChartTypes,
    ChartTypeName,
    GrapherTabOption,
} from "grapher/core/GrapherConstants"
import { GrapherInterface } from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"
import { ExploreUrl } from "./ExploreUrl"
import { RootStore, StoreEntry } from "./Store"
import { Indicator } from "./Indicator"

export type ExplorerChartType = ChartTypeName | "WorldMap"

function grapherConfigFromIndicator(
    indicator: Indicator
): Partial<GrapherInterface> {
    return {
        ...indicator,
        // TODO need to derive selected data from ExploreModel, since selections
        // should persist when switching indicators.
        selectedEntityNames: ["World"],
    }
}

export class ExploreModel {
    static WorldMap: ExplorerChartType = "WorldMap"
    static defaultChartType: ExplorerChartType = ChartTypes.LineChart

    // This is different from the chart's concept of chart type because it includes "WorldMap" as
    // an option, and doesn't include certain chart types we don't support right now, such as
    // scatter plots
    @observable chartType: ExplorerChartType = ExploreModel.defaultChartType

    @observable indicatorId?: number = undefined

    grapher: Grapher
    url: ExploreUrl
    store: RootStore
    disposers: IReactionDisposer[] = []

    @action.bound setIndicatorId(id?: number) {
        this.indicatorId = id
    }

    @action.bound setChartType(chartType: ExplorerChartType) {
        this.chartType = chartType
        this.updateGrapherFromExplorer()
    }

    @action.bound updateGrapherFromExplorer() {
        this.grapher.type = this.configChartType
        this.grapher.hasMapTab = this.isMap
        this.grapher.hasChartTab = !this.isMap
        this.grapher.currentTab = this.isMap
            ? GrapherTabOption.map
            : GrapherTabOption.chart
    }

    constructor(store: RootStore) {
        this.store = store
        this.grapher = new Grapher()
        this.url = new ExploreUrl(this, this.grapher.url)

        // We need these updates in an autorun because the chart config objects aren't really meant
        // to be recreated all the time. They aren't pure value objects and have behaviors on
        // instantiation that include fetching data over the network. Instead, we rely on their
        // observable properties, and on this autorun block to connect them to the Explore controls.
        // -@jasoncrawford 2019-12-04
        this.disposers.push(
            autorun(() => {
                if (this.indicatorEntry === null) {
                    this.grapher.setDimensionsFromConfigs([])
                } else {
                    const indicator = this.indicatorEntry.entity
                    if (indicator) {
                        this.grapher.updateFromObject(
                            grapherConfigFromIndicator(indicator)
                        )
                    }
                }
            })
        )
    }

    dispose() {
        this.disposers.forEach((dispose) => dispose())
    }

    populateFromQueryStr(queryStr?: string) {
        this.url.populateFromQueryStr(queryStr)
    }

    @computed get isMap() {
        return this.chartType === "WorldMap"
    }

    // Translates between the chart type chosen in the Explore UI, and the type we want to set on
    // the ChartConfigProps. It's a pass-through unless map is chosen, in which case we tell the
    // chart (arbitrarily) to be a line chart, and set the tab to map.
    @computed get configChartType(): ChartTypeName {
        return this.isMap
            ? ChartTypes.LineChart
            : (this.chartType as ChartTypeName)
    }

    @computed get indicatorEntry() {
        return this.indicatorId
            ? this.store.indicators.get(this.indicatorId)
            : null
    }
}
