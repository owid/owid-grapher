import { computed, action } from "mobx"

import { ObservableUrl } from "grapher/utils/UrlBinder"
import { ExploreModel } from "./ExploreModel"
import { GrapherUrl, GrapherQueryParams } from "grapher/core/GrapherUrl"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { omit } from "grapher/utils/Util"
import { ChartTypeName } from "grapher/core/GrapherConstants"

type ExploreQueryParams = Omit<GrapherQueryParams, "tab"> & {
    type?: string
    indicator?: string
}

export class ExploreUrl implements ObservableUrl {
    model: ExploreModel
    chartUrl: GrapherUrl

    constructor(model: ExploreModel, chartUrl: GrapherUrl) {
        this.model = model
        this.chartUrl = chartUrl
    }

    @computed get params(): QueryParams {
        const { model } = this

        const params: ExploreQueryParams = omit(this.chartUrl.params, "tab")

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
            model.setChartType(chartType as ChartTypeName)
        }

        if (params.indicator) {
            const id = parseInt(params.indicator)
            model.setIndicatorId(isNaN(id) ? undefined : id)
        }

        model.grapher.populateFromQueryParams(params)
    }
}
