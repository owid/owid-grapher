import { computed } from "mobx"

import { QueryParams, strToQueryParams } from "utils/client/url"
import { ChartQueryParams, ChartUrl } from "./ChartUrl"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { ObservableUrl } from "./UrlBinding"
import { extend, omit } from "./Util"

type ExploreQueryParams = Omit<ChartQueryParams, "tab"> & {
    type?: string
    indicator?: string
}

export class ExploreUrl implements ObservableUrl {
    model: ExploreModel
    chartUrl: ChartUrl

    constructor(model: ExploreModel, chartUrl: ChartUrl) {
        this.model = model
        this.chartUrl = chartUrl
    }

    @computed get params(): QueryParams {
        const params: ExploreQueryParams = {}
        const { model } = this

        extend(params, omit(this.chartUrl.params, "tab"))

        params.type =
            model.chartType === ExploreModel.defaultChartType
                ? undefined
                : model.chartType

        params.indicator = model.indicatorId
            ? model.indicatorId.toString()
            : undefined

        return params as QueryParams
    }

    @computed get debounceMode(): boolean {
        return this.chartUrl.debounceMode
    }

    populateFromQueryStr(queryStr?: string) {
        if (queryStr === undefined) return
        this.populateFromQueryParams(strToQueryParams(queryStr))
    }

    populateFromQueryParams(params: ExploreQueryParams) {
        const { model } = this

        const chartType = params.type
        if (chartType) {
            model.chartType = chartType as ExplorerChartType
        }

        if (params.indicator) {
            const id = parseInt(params.indicator)
            model.indicatorId = isNaN(id) ? undefined : id
        }

        this.chartUrl.populateFromQueryParams(params)
    }
}
