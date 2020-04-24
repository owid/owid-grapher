import { computed } from "mobx"

import { ObservableUrl } from "charts/UrlBinding"
import { QueryParams, strToQueryParams } from "utils/client/url"
import {
    GlobalEntitySelection,
    GlobalEntitySelectionModes
} from "./GlobalEntitySelection"

type GlobalEntitySelectionQueryParams = {
    country?: string
}

export class GlobalEntitySelectionUrl implements ObservableUrl {
    globalEntitySelection: GlobalEntitySelection

    constructor(globalEntitySelection: GlobalEntitySelection) {
        this.globalEntitySelection = globalEntitySelection
    }

    @computed get params(): GlobalEntitySelectionQueryParams {
        const params: GlobalEntitySelectionQueryParams = {}
        const entities = this.globalEntitySelection.selectedEntities
        // Do not add 'country' param unless at least one country is selected
        if (entities.length > 0) {
            params.country = entities.map(entity => entity.code).join("+")
        }
        return params
    }

    @computed get debounceMode(): boolean {
        return false
    }

    populateFromQueryStr(queryStr?: string) {
        if (queryStr === undefined) return
        this.populateFromQueryParams(strToQueryParams(queryStr))
    }

    private populateFromQueryParams(params: QueryParams) {
        if (params.country) {
            const countryCodes = params.country.split("+")
            this.globalEntitySelection.mode =
                GlobalEntitySelectionModes.override
            this.globalEntitySelection.selectByCountryCodes(countryCodes)
        }
    }
}
