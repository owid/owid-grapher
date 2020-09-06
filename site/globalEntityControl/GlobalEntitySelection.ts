import { observable, reaction, IReactionDisposer, computed } from "mobx"

import { Country, countries } from "utils/countries"
import { Grapher } from "grapher/core/Grapher"
import { excludeUndefined } from "grapher/utils/Util"
import { UrlBinder, ObservableUrl } from "grapher/utils/UrlBinder"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"

export enum GlobalEntitySelectionModes {
    none = "none",
    // Possibly might need the `add` state in the future to
    // add country from geolocation without clearing others.
    // One thing to figure out is what its behaviour should
    // be for single-entity charts.

    // add = "add",
    override = "override"
}

export type GlobalEntitySelectionEntity = Country

export class GlobalEntitySelection {
    private url?: GlobalEntitySelectionUrl
    private isBoundToWindow: boolean = false

    @observable mode: GlobalEntitySelectionModes =
        GlobalEntitySelectionModes.none
    @observable
    selectedEntities: GlobalEntitySelectionEntity[] = []

    selectByCountryCodes(codes: string[]) {
        // We want to preserve the order, because order matters – the first entity is the "primary"
        // that is used on single-entity charts.
        this.selectedEntities = excludeUndefined(
            codes.map(code => countries.find(country => country.code === code))
        )
    }

    bindUrlParamsToWindow() {
        if (!this.isBoundToWindow) {
            this.url = new GlobalEntitySelectionUrl(this)
            this.url.populateFromQueryStr(window.location.search)
            new UrlBinder().bindToWindow(this.url)
        }
    }
}

export function subscribeGrapherToGlobalEntitySelection(
    grapher: Grapher,
    globalSelection: GlobalEntitySelection
): IReactionDisposer {
    return reaction(
        () => [
            grapher.isReady,
            globalSelection.mode,
            globalSelection.selectedEntities
        ],
        () => {
            if (!grapher.canAddData && !grapher.canChangeEntity) {
                // Chart doesn't support changing entities - do nothing
                return
            }
            const { mode, selectedEntities } = globalSelection
            // This implements "override" mode only!
            if (mode === GlobalEntitySelectionModes.override) {
                if (selectedEntities.length > 0) {
                    grapher.setSelectedEntitiesByCode(
                        selectedEntities.map(entity => entity.code)
                    )
                } else {
                    grapher.resetSelectedEntities()
                }
            }
        },
        { fireImmediately: true }
    )
}

export function pageContainsGlobalEntityControl() {
    return document.querySelector("[data-global-entity-control]") !== null
}

type GlobalEntitySelectionQueryParams = {
    country?: string
}

class GlobalEntitySelectionUrl implements ObservableUrl {
    globalEntitySelection: GlobalEntitySelection

    constructor(globalEntitySelection: GlobalEntitySelection) {
        this.globalEntitySelection = globalEntitySelection
    }

    @computed get params(): GlobalEntitySelectionQueryParams {
        const params: GlobalEntitySelectionQueryParams = {}
        const entities = this.globalEntitySelection.selectedEntities
        // Do not add 'country' param unless at least one country is selected
        if (entities.length > 0) {
            params.country = EntityUrlBuilder.entitiesToQueryParam(
                entities.map(entity => entity.code)
            )
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
            const countryCodes = EntityUrlBuilder.queryParamToEntities(
                params.country
            )
            this.globalEntitySelection.mode =
                GlobalEntitySelectionModes.override
            this.globalEntitySelection.selectByCountryCodes(countryCodes)
        }
    }
}
