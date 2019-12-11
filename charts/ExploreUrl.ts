import { computed } from "mobx"

import { ObservableUrl } from "./UrlBinding"
import { ExploreModel, ExplorerChartType } from "./ExploreModel"
import { ChartUrl, ChartQueryParams } from "./ChartUrl"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { omit, extend } from "./Util"

type ExploreQueryParams = Omit<ChartQueryParams, "tab"> & {
    type?: string
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

        this.chartUrl.populateFromQueryParams(params)
    }
}
