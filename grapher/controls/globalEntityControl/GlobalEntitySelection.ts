import { observable, reaction, IReactionDisposer, computed } from "mobx"
import { Country, countries } from "utils/countries"
import { Grapher } from "grapher/core/Grapher"
import { excludeUndefined, isMobile } from "grapher/utils/Util"
import {
    UrlBinder,
    ObjectThatSerializesToQueryParams,
} from "grapher/utils/UrlBinder"
import { QueryParams, strToQueryParams } from "utils/client/url"
import { EntityUrlBuilder } from "grapher/core/EntityUrlBuilder"
import { GLOBAL_ENTITY_CONTROL_DATA_ATTR } from "./GlobalEntityControlConstants"

// Determine whether this device is powerful enough to handle
// loading a bunch of inline interactive charts
// 680px is also used in CSS – keep it in sync if you change this
export const shouldProgressiveEmbed = () =>
    !isMobile() ||
    window.screen.width > 680 ||
    pageContainsGlobalEntityControl()

export enum GlobalEntitySelectionModes {
    none = "none",
    // Possibly might need the `add` state in the future to
    // add country from geolocation without clearing others.
    // One thing to figure out is what its behaviour should
    // be for single-entity charts.

    // add = "add",
    override = "override",
}

export type GlobalEntitySelectionEntity = Country

export class GlobalEntitySelection {
    private url?: GlobalEntitySelectionUrl
    private isBoundToWindow = false

    @observable mode = GlobalEntitySelectionModes.none
    @observable selectedEntities: GlobalEntitySelectionEntity[] = []

    selectByCountryCodes(codes: string[]) {
        // We want to preserve the order, because order matters – the first entity is the "primary"
        // that is used on single-entity charts.
        this.selectedEntities = excludeUndefined(
            codes.map((code) =>
                countries.find((country) => country.code === code)
            )
        )
    }

    bindUrlParamsToWindow() {
        if (this.isBoundToWindow) return

        this.url = new GlobalEntitySelectionUrl(this)
        this.url.populateFromQueryStr(window.location.search)
        new UrlBinder().bindToWindow(this.url)
    }
}

export const GlobalEntitySelectionSingleton = new GlobalEntitySelection()

export const subscribeGrapherToGlobalEntitySelection = (
    grapher: Grapher,
    globalSelection: GlobalEntitySelection
): IReactionDisposer =>
    reaction(
        () => [
            grapher.isReady,
            globalSelection.mode,
            globalSelection.selectedEntities,
        ],
        () => {
            if (!grapher.canSelectMultipleEntities && !grapher.canChangeEntity)
                // Chart doesn't support changing entities - do nothing
                return
            const { mode, selectedEntities } = globalSelection
            // This implements "override" mode only!
            if (mode === GlobalEntitySelectionModes.override) {
                if (selectedEntities.length > 0)
                    grapher.selection.setSelectedEntitiesByCode(
                        selectedEntities.map((entity) => entity.code)
                    )
                else grapher.selection.clearSelection()
            }
        },
        { fireImmediately: true }
    )

export const pageContainsGlobalEntityControl = () =>
    document.querySelector(`[${GLOBAL_ENTITY_CONTROL_DATA_ATTR}]`) !== null

type GlobalEntitySelectionQueryParams = {
    country?: string
}

class GlobalEntitySelectionUrl implements ObjectThatSerializesToQueryParams {
    globalEntitySelection: GlobalEntitySelection

    constructor(globalEntitySelection: GlobalEntitySelection) {
        this.globalEntitySelection = globalEntitySelection
    }

    @computed get params() {
        const params: GlobalEntitySelectionQueryParams = {}
        const entities = this.globalEntitySelection.selectedEntities
        // Do not add 'country' param unless at least one country is selected
        if (entities.length > 0) {
            params.country = EntityUrlBuilder.entityNamesToQueryParam(
                entities.map((entity) => entity.code)
            )
        }
        return params
    }

    debounceMode = false

    populateFromQueryStr(queryStr?: string) {
        if (queryStr === undefined) return
        this.populateFromQueryParams(strToQueryParams(queryStr))
    }

    private populateFromQueryParams(params: QueryParams) {
        if (params.country) {
            const countryCodes = EntityUrlBuilder.queryParamToEntityNames(
                params.country
            )
            this.globalEntitySelection.mode =
                GlobalEntitySelectionModes.override
            this.globalEntitySelection.selectByCountryCodes(countryCodes)
        }
    }
}
