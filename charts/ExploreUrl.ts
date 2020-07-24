import { computed, action } from "mobx"

import { ObservableUrl } from "./UrlBinding"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { ChartUrl, ChartQueryParams } from "./ChartUrl"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { omit, extend } from "./Util"

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

    @action.bound populateFromQueryParams(params: ExploreQueryParams) {
        const { model } = this

        const chartType = params.type
        if (chartType) {
            model.setChartType(chartType as ExplorerChartType)
        }

        if (params.indicator) {
            const id = parseInt(params.indicator)
            model.setIndicatorId(isNaN(id) ? undefined : id)
        }

        this.chartUrl.populateFromQueryParams(params)
    }
}
