import { computed } from "mobx"

import { ObservableUrl } from "charts/UrlBinding"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { GlobalEntitySelection } from "./GlobalEntitySelection"

type GlobalEntitySelectionQueryParams = {
    country: string
}

export class GlobalEntitySelectionUrl implements ObservableUrl {
    globalEntitySelection: GlobalEntitySelection

    constructor(globalEntitySelection: GlobalEntitySelection) {
        this.globalEntitySelection = globalEntitySelection
    }

    @computed get params(): GlobalEntitySelectionQueryParams {
        const entities = this.globalEntitySelection.selectedEntities
        return {
            country: entities.map(entity => entity.code).join("+")
        }
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
            this.globalEntitySelection.selectByCountryCodes(countryCodes)
        }
    }
}
