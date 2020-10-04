import { observable, computed, autorun, IReactionDisposer, action } from "mobx"
import { ChartTypeName, GrapherTabOption } from "grapher/core/GrapherConstants"
import {
    GrapherInterface,
    GrapherQueryParams,
} from "grapher/core/GrapherInterface"
import { Grapher } from "grapher/core/Grapher"
import { RootStore } from "./Store"
import { Indicator } from "./Indicator"
import { ObservableUrl } from "grapher/utils/UrlBinder"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { omit } from "grapher/utils/Util"

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

export class ExploreModel implements ObservableUrl {
    static WorldMap: ChartTypeName = ChartTypeName.WorldMap
    static defaultChartType: ChartTypeName = ChartTypeName.LineChart

    // This is different from the chart's concept of chart type because it includes "WorldMap" as
    // an option, and doesn't include certain chart types we don't support right now, such as
    // scatter plots
    @observable chartType: ChartTypeName = ExploreModel.defaultChartType

    @observable indicatorId?: number = undefined

    grapher: Grapher
    store: RootStore
    disposers: IReactionDisposer[] = []

    @action.bound setIndicatorId(id?: number) {
        this.indicatorId = id
    }

    @action.bound setChartType(chartType: ChartTypeName) {
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
        if (queryStr === undefined) return
        this.populateFromQueryParams(strToQueryParams(queryStr))
    }

    @computed get isMap() {
        return this.chartType === "WorldMap"
    }

    // Translates between the chart type chosen in the Explore UI, and the type we want to set on
    // the ChartConfigProps. It's a pass-through unless map is chosen, in which case we tell the
    // chart (arbitrarily) to be a line chart, and set the tab to map.
    @computed get configChartType(): ChartTypeName {
        return this.isMap
            ? ChartTypeName.LineChart
            : (this.chartType as ChartTypeName)
    }

    @computed get indicatorEntry() {
        return this.indicatorId
            ? this.store.indicators.get(this.indicatorId)
            : null
    }

    @computed get params(): QueryParams {
        const params: ExploreQueryParams = omit(this.grapher.params, "tab")

        params.type =
            this.chartType === ExploreModel.defaultChartType
                ? undefined
                : this.chartType

        params.indicator = this.indicatorId
            ? this.indicatorId.toString()
            : undefined

        return params as QueryParams
    }

    @computed get debounceMode() {
        return this.grapher.debounceMode
    }

    @action.bound populateFromQueryParams(params: ExploreQueryParams) {
        const chartType = params.type
        if (chartType) this.setChartType(chartType as ChartTypeName)

        if (params.indicator) {
            const id = parseInt(params.indicator)
            this.setIndicatorId(isNaN(id) ? undefined : id)
        }

        this.grapher.populateFromQueryParams(params)
    }
}

type ExploreQueryParams = Omit<GrapherQueryParams, "tab"> & {
    type?: string
    indicator?: string
}
